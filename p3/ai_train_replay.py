"""End-to-end read-only AI train -> holdout decisions -> paper replay.

No model is trained on validation or holdout. Predictions are generated only
from features of already closed candles, then filled on the next native bar.
"""
import json
import os
from .ai_feature_history import load_native_features
from .native_history_replay import load_native_candles
from .ai_training_pipeline import train_horizon, EMBARGO_MS
from .multi_model_replay import STRATEGY_TIMEFRAMES
from .replay_runner import replay_with_metrics
from .fee_schedule import load_fee_rate
from .execution_diagnostics import summarize_execution
from .validation_selection import select_threshold
from .training_settings import load_training_settings
from .training_registry import record_training_reports
from .experiment_scheduler import load_schedule_from_supabase, eligible_candidate_trials
from .candidate_trial_runner import evaluate_candidate_trials
from .model_qualification import evaluate_model_gates
from .model_provenance import fingerprint_rows, pinned_code_version, fee_fingerprint
from .ai_decision_model import FEATURE_COLUMNS

def run_training(db, symbol, *, years=2, confidence_threshold=0.6):
    fee_rate = load_fee_rate(db)
    reports = {}
    for strategy, timeframe in STRATEGY_TIMEFRAMES.items():
        print(json.dumps({"status": "MODEL_STARTED", "strategy": strategy, "timeframe": timeframe}), flush=True)
        candles = load_native_candles(db, symbol, timeframe)
        features = load_native_features(db, symbol, timeframe)
        provenance = {
            "dataset_version": fingerprint_rows(candles, ("open_time", "close_time", "open", "high", "low", "close")),
            "feature_version": fingerprint_rows(features, ("open_time", "close_time", "close_price") + FEATURE_COLUMNS),
            "code_version": pinned_code_version(),
            "fee_version": fee_fingerprint(fee_rate),
        }
        # Explore candidates on training data; rank ONLY by validation results.
        # Holdout is evaluated once after the candidate has been selected.
        experiments = []
        winner = None
        for params in ({"max_iter": 120, "learning_rate": 0.1},
                       {"max_iter": 180, "learning_rate": 0.05}):
            candidate = train_horizon(features, candles, strategy, years=years,
                                      model_params=params)
            candidate_selection = select_threshold(
                candles, features, candidate["model"], symbol,
                candidate["windows"]["validation"], fee_rate)
            threshold = candidate_selection["selected_threshold"]
            selected = next((row for row in candidate_selection["candidates"]
                             if row["threshold"] == threshold), None)
            score = (selected["return_percent"] - selected["drawdown_percent"]
                     if selected is not None else None)
            candidate_rows = candidate_selection["candidates"]
            if score is not None:
                failure_reason = None
            elif any(row["execution_path_uncertain"] for row in candidate_rows):
                failure_reason = "execution_path_uncertain"
            elif all(row["closed_trades"] == 0 for row in candidate_rows):
                failure_reason = "no_closed_trades"
            elif all(row["closed_trades"] < 5 for row in candidate_rows):
                failure_reason = "insufficient_closed_trades"
            elif all(row["drawdown_percent"] > 8.0 for row in candidate_rows):
                failure_reason = "validation_drawdown_exceeded"
            else:
                failure_reason = "no_eligible_validation_threshold"
            experiments.append({"params": params, "validation_score": score,
                                "validation_eligible": score is not None,
                                "selected_threshold": threshold,
                                "failure_reason": failure_reason,
                                "validation_candidates": candidate_rows})
            if score is not None and (winner is None or score > winner[0]):
                winner = (score, candidate, candidate_selection, params)
        # A bounded second stage reacts only to validation diagnostics.
        # Do not use holdout outcomes to propose or rank candidates.
        reasons = [row["failure_reason"] for row in experiments]
        if winner is None and reasons and all(reason == "no_closed_trades" for reason in reasons):
            next_params = {"max_iter": 240, "learning_rate": 0.03}
            adaptation_reason = "validation_no_closed_trades"
        elif winner is None and reasons and all(reason == "execution_path_uncertain" for reason in reasons):
            next_params = {"max_iter": 80, "learning_rate": 0.05}
            adaptation_reason = "validation_execution_uncertainty"
        elif winner is not None:
            next_params = {"max_iter": 240, "learning_rate": 0.05}
            adaptation_reason = "validation_eligible_refinement"
        else:
            next_params = None
            adaptation_reason = "no_safe_adaptation"
        # Plan the next experiment rather than repeatedly searching the same
        # validation period; repeated tuning risks overfitting.
        next_experiment = {"params": next_params, "reason": adaptation_reason,
                           "status": "PROPOSED" if next_params else "WAIT",
                           "requires_new_validation_window": True}
        if winner is None:
            # No eligible candidate: retain a reportable baseline, never trade.
            trained = candidate
            selection = candidate_selection
            chosen_params = None
            selection = {**selection, "selected_threshold": None}
        else:
            _, trained, selection, chosen_params = winner
        model = trained["model"]
        selected_threshold = selection["selected_threshold"]
        holdout_start, holdout_end = trained["windows"]["holdout"]
        # Embargo is enforced on decisions as well as training examples.
        earliest = holdout_start + EMBARGO_MS
        feature_by_close = {int(row["close_time"]): row for row in features}
        decisions = {}
        for candle in candles:
            t = int(candle["close_time"])
            if selected_threshold is not None and earliest <= t < holdout_end and t in feature_by_close:
                decisions[t] = model.decide(
                    symbol, feature_by_close[t],
                    confidence_threshold=selected_threshold,
                )
        # No validated threshold means WAIT, not a silent default threshold.
        # Holdout never influences candidate selection.
        # Include one pre-holdout bar only if it cannot cause an entry.
        holdout_candles = [
            c for c in candles if earliest <= int(c["open_time"])
            and int(c["close_time"]) < holdout_end
        ]
        if len(holdout_candles) < 2:
            raise ValueError("insufficient holdout replay candles")
        outcome = replay_with_metrics(holdout_candles, decisions, fee_rate=fee_rate)
        metrics = outcome["metrics"]
        qualification = evaluate_model_gates(selection, metrics)
        reports[strategy] = {
            "qualification": qualification,
            "optimization": {"selection_source": "validation_only",
                             "experiments": experiments,
                             "selected_params": chosen_params,
                             "next_experiment": next_experiment},
            "provenance": provenance,
            "timeframe": timeframe,
            "validation_window": list(trained["windows"]["validation"]),
            "holdout_window": list(trained["windows"]["holdout"]),
            "validation_selection": selection,
            "holdout_threshold": selected_threshold,
            "model_eligible_for_paper": qualification["paper_eligible"],
            "holdout_threshold_fallback": selected_threshold is None,
            "execution_diagnostics": summarize_execution(outcome["account"], outcome["events"]),
            "fee_rate_per_side": fee_rate,
            "training_samples": len(trained["partitions"]["train"]["X"]),
            "validation_samples": len(trained["partitions"]["validation"]["X"]),
            "holdout_label_samples": len(trained["partitions"]["holdout"]["X"]),
            "holdout_candles": len(holdout_candles),
            "decisions": {
                action: sum(d.action == action for d in decisions.values())
                for action in ("LONG", "SHORT", "WAIT")
            },
            "closed_trades": metrics["closed_trades"],
            "realized_net_pnl": metrics.get("realized_net_pnl"),
            "win_rate_percent": metrics.get("win_rate_percent"),
            "annualized_mark_to_market_return_percent": metrics.get(
                "annualized_mark_to_market_return_percent"),
            "max_close_to_close_drawdown_percent": metrics.get(
                "max_close_to_close_drawdown_percent"),
            "execution_path_uncertain": metrics["execution_path_uncertain"],
            "final_equity": metrics["final_mark_to_market_equity"],
            "holdout_start_ms": earliest,
            "holdout_end_ms": holdout_end,
        }
        print(json.dumps({"status": "MODEL_COMPLETE", "strategy": strategy, "timeframe": timeframe, "report": reports[strategy]}, allow_nan=False), flush=True)
    return reports

def main():
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
    from collector import db
    settings = load_training_settings(db)
    symbol = settings["symbol"]
    years = settings["years"]
    # Autonomous proposals are advisory until a later, non-overlapping
    # evaluation protocol is approved. Baseline training remains unchanged.
    schedule = load_schedule_from_supabase(db, symbol, years=years)
    print(json.dumps({"status": "EXPERIMENT_SCHEDULE", **schedule},
                     sort_keys=True, allow_nan=False), flush=True)
    print(json.dumps({"status": "EXPERIMENT_TRIAL_MANIFEST",
                      "trials": eligible_candidate_trials(schedule),
                      "execution": "DISABLED_UNTIL_WINDOW_ISOLATION_VERIFIED"},
                     sort_keys=True, allow_nan=False), flush=True)
    # Candidate execution is deliberately separate from baseline and is
    # validation-only; it cannot change the selected production model.
    trials = eligible_candidate_trials(schedule)
    if trials:
        fee_rate = load_fee_rate(db)
        required = {STRATEGY_TIMEFRAMES[t["strategy"]] for t in trials}
        candles_by_timeframe = {tf: load_native_candles(db, symbol, tf) for tf in required}
        features_by_timeframe = {tf: load_native_features(db, symbol, tf) for tf in required}
        candidate_results = evaluate_candidate_trials(
            schedule, symbol=symbol, years=years,
            candles_by_timeframe=candles_by_timeframe,
            features_by_timeframe=features_by_timeframe, fee_rate=fee_rate)
        print(json.dumps({"status": "CANDIDATE_VALIDATION_RESULTS",
                          "results": candidate_results,
                          "promotion": "DISABLED"},
                         sort_keys=True, allow_nan=False), flush=True)
    print(json.dumps({"status": "TRAINING_STARTED", "symbol": symbol}), flush=True)
    result = run_training(db, symbol, years=years)
    registry = record_training_reports(db, symbol, years, result)
    print(json.dumps({"status": "REGISTRY", **registry}), flush=True)
    print(json.dumps({"status": "COMPLETE", "symbol": symbol, "models": result},
                     sort_keys=True, allow_nan=False), flush=True)

if __name__ == "__main__":
    main()
