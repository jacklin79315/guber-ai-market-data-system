"""Sequential autonomous training with original validation-only trade replay.

Each candidate trains on the chronological training partition, replays only
validation trades, and never inspects the final holdout for model selection.
"""
import json
import os
import hashlib
from datetime import datetime, timezone
from .ai_training_pipeline import _add_months, chronological_windows, DAY_MS, train_horizon
from .validation_selection import select_threshold
from .fee_schedule import load_fee_rate
from .adaptive_trial_selection import next_candidate, next_layer_candidate, validated_rank
from .ai_training_batch import PARAMETERS
from .ai_feature_history import load_native_features
from .native_history_replay import load_native_candles
from .multi_model_replay import STRATEGY_TIMEFRAMES
from .training_settings import load_training_settings
from .model_diagnostics import diagnose_validation
from .learning_feedback import compare_trials


def run_iterations(db, *, symbol, strategy, years, iterations=5):
    if not 1 <= iterations <= 100:
        raise ValueError("iterations must be between 1 and 100")
    timeframe = STRATEGY_TIMEFRAMES[strategy]
    candles = load_native_candles(db, symbol, timeframe)
    features = load_native_features(db, symbol, timeframe)
    end = ((int(candles[-1]["close_time"]) + 1) // DAY_MS) * DAY_MS
    windows = chronological_windows(_add_months(end, -12 * years), years=years)
    train_begin, train_end = windows["train"]
    validation_begin, validation_end = windows["validation"]
    # A stable dataset-scoped ID resumes the same experiment without mixing
    # incompatible historical windows or the original 200 batch trials.
    experiment = json.dumps(["autonomous-v3-dual-feature-layers", symbol, strategy, years,
                             timeframe, train_begin, train_end], separators=(",", ":"))
    run_id = "autonomous-v3-" + hashlib.sha256(experiment.encode()).hexdigest()[:24]
    previous = db("GET", "ai_training_batch_trials", {
        "select": "trial_index,status,validation_eligible,validation_score,params,error_reason,validation_return_percent,validation_drawdown_percent,validation_trades,selected_threshold,validation_annualized_return_percent,validation_win_rate_percent,validation_mean_score_q,diagnostics",
        "run_id": "eq." + run_id, "strategy": "eq." + strategy,
        "order": "trial_index.asc", "limit": "100",
    })
    # RUNNING rows may be left by interrupted jobs; they are retried below.
    history = [{"trial_index": row["trial_index"], "params": row["params"],
                "status": row["status"],
                "validation_eligible": row.get("validation_eligible"),
                "validation_score": row.get("validation_score"),
                "error": row.get("error_reason"),
                "validation_return_percent": row.get("validation_return_percent"),
                "validation_drawdown_percent": row.get("validation_drawdown_percent"),
                "validation_trades": row.get("validation_trades"),
                "validation_annualized_return_percent": row.get("validation_annualized_return_percent"),
                "validation_win_rate_percent": row.get("validation_win_rate_percent"),
                "validation_mean_score_q": row.get("validation_mean_score_q"),
                "selected_threshold": row.get("selected_threshold"),
                "diagnostics": row.get("diagnostics")}
               for row in previous if row["status"] in ("COMPLETE", "FAILED")]
    history.sort(key=lambda row: row["trial_index"])
    if [row["trial_index"] for row in history] != list(range(1, len(history) + 1)):
        raise RuntimeError("non-contiguous persisted training history; manual repair required")
    for row in history[:iterations]:
        print(json.dumps({"status": "ITERATION_RESULT", "strategy": strategy,
                          "resumed": True, **row}, allow_nan=False), flush=True)
    # The existing 25-candidate grid is reused as the initial search space.
    # For longer runs, a new local grid is generated around the best candidate.
    candidates = list(PARAMETERS)
    candidates.extend(
        {"max_iter": steps, "learning_rate": round(rate / 1000, 5)}
        for steps in range(40, 341, 20)
        for rate in range(15, 186, 10))
    fee_rate = load_fee_rate(db)
    for index in range(len(history), iterations):
        params = next_layer_candidate(history) or next_candidate(candidates, history)
        if params is None:
            best = max((h for h in history if h["status"] == "COMPLETE" and validated_rank(h) is not None),
                       key=validated_rank, default=None)
            if best is None:
                raise RuntimeError("no successful iterations to refine")
            anchor = best["params"]
            candidates.extend(
                {"max_iter": max(20, anchor["max_iter"] + delta),
                 "learning_rate": round(max(0.005, anchor["learning_rate"] + rate), 5)}
                for delta in (-30, -15, 15, 30)
                for rate in (-0.02, -0.01, 0.01, 0.02))
            params = next_candidate(candidates, history)
            if params is None:
                raise RuntimeError("candidate search exhausted")
        db("POST", "ai_training_batch_trials",
           {"on_conflict": "run_id,strategy,trial_index"}, [{
               "run_id": run_id, "symbol": symbol, "strategy": strategy,
               "timeframe": timeframe, "lookback_years": years,
               "trial_index": index + 1, "status": "RUNNING", "params": params,
               "validation_start_ms": validation_begin,
               "validation_end_ms": validation_end,
           }], {"Prefer": "resolution=merge-duplicates,return=minimal"})
        # Restore the original validation-only trading replay. The outer
        # holdout remains untouched, and model selection uses net trading
        # return minus drawdown rather than direction-classification Brier score.
        error = None
        winner = None
        observed = None
        selected_threshold = None
        diagnostics = None
        training_samples = None
        validation_samples = None
        try:
            trained = train_horizon(
                features, candles, strategy, years=years, model_params=params)
            selection = select_threshold(
                candles, features, trained["model"], symbol,
                trained["windows"]["validation"], fee_rate)
            diagnostics = diagnose_validation(trained["model"], trained["partitions"]["validation"])
            selected_threshold = selection["selected_threshold"]
            print(json.dumps({
                "status": "VALIDATION_DECISION_FUNNEL",
                "strategy": strategy,
                "trial_index": index + 1,
                "thresholds": [
                    {"threshold": candidate["threshold"],
                     "eligible": candidate["eligible"],
                     "closed_trades": candidate["closed_trades"],
                     "decision_flow": candidate["decision_flow"]}
                    for candidate in selection["candidates"]
                ],
                "validation_only": True,
                "selection_policy_unchanged": True,
            }, allow_nan=False), flush=True)
            winner = next(
                (c for c in selection["candidates"]
                 if c["threshold"] == selected_threshold), None)
            # Keep the replay measurements even when no candidate qualifies.
            # Eligibility and selection remain unchanged.
            observed = winner if winner is not None else max(
                selection["candidates"],
                key=lambda c: (c.get("annualized_return_percent") or float("-inf"),
                               c.get("win_rate_percent") or float("-inf"),
                               c.get("mean_score_q") or float("-inf"), c["threshold"]),
                default=None)
            training_samples = trained["coverage"]["train"]["samples"]
            validation_samples = trained["coverage"]["validation"]["samples"]
        except Exception as exc:
            error = str(exc)
        score = None  # Deprecated DB field; not used for ranking.
        result = {"trial_index": index + 1, "params": params,
                  "status": "COMPLETE" if error is None else "FAILED",
                  "validation_eligible": winner is not None,
                  "validation_score": score,
                  "validation_return_percent": observed["return_percent"] if observed else None,
                  "validation_drawdown_percent": observed["drawdown_percent"] if observed else None,
                  "validation_trades": observed["closed_trades"] if observed else None,
                  "validation_win_rate_percent": observed["win_rate_percent"] if observed else None,
                  "validation_mean_score_q": observed["mean_score_q"] if observed else None,
                  "validation_annualized_return_percent": observed["annualized_return_percent"] if observed else None,
                  "validation_annualized_mark_to_market_return_percent": observed["annualized_mark_to_market_return_percent"] if observed else None,
                  "selected_threshold": selected_threshold,
                  "diagnostics": diagnostics,
                  "error": error}
        db("POST", "ai_training_batch_trials",
           {"on_conflict": "run_id,strategy,trial_index"}, [{
               "run_id": run_id, "symbol": symbol, "strategy": strategy,
               "timeframe": timeframe, "lookback_years": years,
               "trial_index": index + 1, "status": result["status"],
               "params": params, "validation_start_ms": validation_begin,
               "validation_end_ms": validation_end,
               "validation_eligible": result["validation_eligible"],
               "validation_score": result["validation_score"],
               "validation_return_percent": result["validation_return_percent"],
               "validation_drawdown_percent": result["validation_drawdown_percent"],
               "validation_trades": result["validation_trades"],
               "validation_annualized_return_percent": result["validation_annualized_return_percent"],
               "validation_win_rate_percent": result["validation_win_rate_percent"],
               "validation_mean_score_q": result["validation_mean_score_q"],
               "selected_threshold": result["selected_threshold"],
               "training_samples": training_samples,
               "validation_samples": validation_samples,
               "diagnostics": result["diagnostics"],
               "error_reason": result["error"],
               "completed_at": datetime.now(timezone.utc).isoformat(),
           }], {"Prefer": "resolution=merge-duplicates,return=minimal"})
        # Diagnostic feedback compares validation errors only; it cannot
        # override the established trading-performance qualification gates.
        prior = next((h for h in reversed(history)
                      if h.get("status") == "COMPLETE" and h.get("diagnostics")), None)
        if prior and diagnostics and result["status"] == "COMPLETE":
            keys = ("direction_accuracy_percent", "direction_brier_score",
                    "upside_mae_percent", "downside_mae_percent")
            changes = {
                key: (diagnostics[key] - prior["diagnostics"][key]
                      if diagnostics.get(key) is not None
                      and prior["diagnostics"].get(key) is not None else None)
                for key in keys
            }
            print(json.dumps({
                "status": "MODEL_LAYER_FEEDBACK",
                "strategy": strategy,
                "previous_trial_index": prior["trial_index"],
                "current_trial_index": result["trial_index"],
                "direction_accuracy_change_pp": changes["direction_accuracy_percent"],
                "direction_brier_change": changes["direction_brier_score"],
                "upside_mae_change_pp": changes["upside_mae_percent"],
                "downside_mae_change_pp": changes["downside_mae_percent"],
                "interpretation": "negative error deltas indicate improvement",
                "validation_only": True,
                "causal_attribution": False,
                "changes_selection_policy": False,
            }, allow_nan=False), flush=True)
        previous_complete = next(
            (item for item in reversed(history) if item["status"] == "COMPLETE"), None)
        if previous_complete is not None and result["status"] == "COMPLETE":
            print(json.dumps({
                "status": "LEARNING_FEEDBACK",
                "strategy": strategy,
                **compare_trials(previous_complete, result),
            }, allow_nan=False), flush=True)
        history.append(result)
        print(json.dumps({"status": "ITERATION_RESULT", "strategy": strategy,
                          **result}, allow_nan=False), flush=True)
    # Compare each completed trial against the preceding completed trial.
    # Observational feedback only: preserve existing qualification and selection.
    previous_complete = None
    for trial in history:
        if trial["status"] != "COMPLETE":
            continue
        if previous_complete is not None:
            fields = {
                "annualized_return_percent": "validation_annualized_return_percent",
                "win_rate_percent": "validation_win_rate_percent",
                "strategy_score": "validation_mean_score_q",
                "drawdown_percent": "validation_drawdown_percent",
                "closed_trades": "validation_trades",
            }
            deltas = {
                name: (float(trial[key]) - float(previous_complete[key])
                       if trial.get(key) is not None and previous_complete.get(key) is not None
                       else None)
                for name, key in fields.items()
            }
            print(json.dumps({
                "status": "ITERATION_COMPARISON",
                "strategy": strategy,
                "previous_trial_index": previous_complete["trial_index"],
                "current_trial_index": trial["trial_index"],
                "metric_deltas": deltas,
                "previous_eligible": previous_complete.get("validation_eligible") is True,
                "current_eligible": trial.get("validation_eligible") is True,
                "selection_policy_unchanged": True,
            }, allow_nan=False), flush=True)
        previous_complete = trial
    # Explain baseline-to-best progress using approved validation metric ordering.
    qualified = [h for h in history if h["status"] == "COMPLETE"
                 and h.get("validation_eligible") is True
                 and validated_rank(h) is not None]
    if qualified:
        baseline_trial = qualified[0]
        champion_trial = max(qualified, key=validated_rank)
        compare_fields = {
            "annualized_return_percent": "validation_annualized_return_percent",
            "win_rate_percent": "validation_win_rate_percent",
            "strategy_score": "validation_mean_score_q",
            "drawdown_percent": "validation_drawdown_percent",
            "closed_trades": "validation_trades",
        }
        differences = {}
        for name, field in compare_fields.items():
            a, b = baseline_trial.get(field), champion_trial.get(field)
            differences[name] = float(b) - float(a) if a is not None and b is not None else None
        print(json.dumps({
            "status": "BASELINE_VS_BEST",
            "strategy": strategy,
            "baseline_trial_index": baseline_trial["trial_index"],
            "best_trial_index": champion_trial["trial_index"],
            "metric_deltas": differences,
            "selection_basis": "annualized_win_rate_quality",
            "cause_of_improvement": "not_established",
            "holdout_used": False,
        }, allow_nan=False), flush=True)
    # Report observed trading metrics even if no model passes the existing gates.
    # This is display-only and does not alter model selection or qualification.
    observed_trials = [h for h in history if h["status"] == "COMPLETE"
                       and h.get("validation_return_percent") is not None
                       and h.get("validation_drawdown_percent") is not None]
    best_observed = max(
        observed_trials,
        key=lambda h: (h.get("validation_annualized_return_percent") or float("-inf"),
                       h.get("validation_win_rate_percent") or float("-inf"),
                       h.get("validation_mean_score_q") or float("-inf")),
        default=None,
    )
    observed_performance = ({
        "trial_index": best_observed["trial_index"],
        "annualized_return_percent": best_observed.get("validation_annualized_return_percent"),
        "win_rate_percent": best_observed.get("validation_win_rate_percent"),
        "strategy_score": best_observed.get("validation_mean_score_q"),
        "closed_trades": best_observed.get("validation_trades"),
        "validation_eligible": best_observed.get("validation_eligible") is True,
        "ranking_basis": "annualized_win_rate_quality_observation",
    } if best_observed else None)
    successful = [h for h in history if validated_rank(h) is not None]
    best = max(successful, key=validated_rank, default=None)
    if not successful:
        return {"status": "ITERATIONS_COMPLETE_NO_ELIGIBLE_MODEL",
                "strategy": strategy, "run_id": run_id,
                "iterations": len(history), "successful": 0,
                "baseline_score": None, "best_score": None,
                "improvement_vs_first_successful": None,
                "best": None, "best_observed_performance": observed_performance,
                "outer_validation_used": True,
                "holdout_used": False}
    baseline = successful[0]
    improvement = (tuple(validated_rank(best)[i] - validated_rank(baseline)[i] for i in range(3))
                   if best is not None and baseline is not None else None)
    return {"status": "ITERATIONS_COMPLETE", "strategy": strategy,
            "run_id": run_id, "iterations": len(history), "successful": len(successful),
            "baseline_score": validated_rank(baseline) if baseline else None,
            "best_score": validated_rank(best) if best else None,
            "improvement_vs_first_successful": improvement,
            "best": best, "best_observed_performance": observed_performance,
            "outer_validation_used": True, "holdout_used": False}


def main():
    from collector import db
    settings = load_training_settings(db)
    result = run_iterations(
        db, symbol=settings["symbol"],
        strategy=os.getenv("TRAINING_BATCH_STRATEGY", "INTRADAY"),
        years=settings["years"],
        iterations=int(os.getenv("TRAINING_ITERATIONS", "5")))
    print(json.dumps(result, allow_nan=False), flush=True)


if __name__ == "__main__":
    main()
