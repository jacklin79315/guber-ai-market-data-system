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
        trained = train_horizon(features, candles, strategy, years=years)
        model = trained["model"]
        selection = select_threshold(candles, features, model, symbol,
                                     trained["windows"]["validation"], fee_rate)
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
    print(json.dumps({"status": "TRAINING_STARTED", "symbol": symbol}), flush=True)
    result = run_training(db, symbol, years=years)
    registry = record_training_reports(db, symbol, years, result)
    print(json.dumps({"status": "REGISTRY", **registry}), flush=True)
    print(json.dumps({"status": "COMPLETE", "symbol": symbol, "models": result},
                     sort_keys=True, allow_nan=False), flush=True)

if __name__ == "__main__":
    main()
