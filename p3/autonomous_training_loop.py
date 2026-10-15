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
from .adaptive_trial_selection import next_candidate
from .ai_training_batch import PARAMETERS
from .ai_feature_history import load_native_features
from .native_history_replay import load_native_candles
from .multi_model_replay import STRATEGY_TIMEFRAMES
from .training_settings import load_training_settings


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
    experiment = json.dumps(["autonomous-v2-trade-replay", symbol, strategy, years,
                             timeframe, train_begin, train_end], separators=(",", ":"))
    run_id = "autonomous-v2-" + hashlib.sha256(experiment.encode()).hexdigest()[:24]
    previous = db("GET", "ai_training_batch_trials", {
        "select": "trial_index,status,validation_eligible,validation_score,params,error_reason,validation_return_percent,validation_drawdown_percent,validation_trades,selected_threshold",
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
                "selected_threshold": row.get("selected_threshold")}
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
        params = next_candidate(candidates, history)
        if params is None:
            best = max((h for h in history if h["status"] == "COMPLETE" and h.get("validation_score") is not None),
                       key=lambda h: h["validation_score"], default=None)
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
        selected_threshold = None
        training_samples = None
        validation_samples = None
        try:
            trained = train_horizon(
                features, candles, strategy, years=years, model_params=params)
            selection = select_threshold(
                candles, features, trained["model"], symbol,
                trained["windows"]["validation"], fee_rate)
            selected_threshold = selection["selected_threshold"]
            winner = next(
                (c for c in selection["candidates"]
                 if c["threshold"] == selected_threshold), None)
            training_samples = trained["coverage"]["train"]["samples"]
            validation_samples = trained["coverage"]["validation"]["samples"]
        except Exception as exc:
            error = str(exc)
        score = (winner["return_percent"] - winner["drawdown_percent"]
                 if winner is not None else None)
        result = {"trial_index": index + 1, "params": params,
                  "status": "COMPLETE" if error is None else "FAILED",
                  "validation_eligible": winner is not None,
                  "validation_score": score,
                  "validation_return_percent": winner["return_percent"] if winner else None,
                  "validation_drawdown_percent": winner["drawdown_percent"] if winner else None,
                  "validation_trades": winner["closed_trades"] if winner else None,
                  "selected_threshold": selected_threshold,
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
               "selected_threshold": result["selected_threshold"],
               "training_samples": training_samples,
               "validation_samples": validation_samples,
               "error_reason": result["error"],
               "completed_at": datetime.now(timezone.utc).isoformat(),
           }], {"Prefer": "resolution=merge-duplicates,return=minimal"})
        history.append(result)
        print(json.dumps({"status": "ITERATION_RESULT", "strategy": strategy,
                          **result}, allow_nan=False), flush=True)
    best = max((h for h in history if h["status"] == "COMPLETE"),
               key=lambda h: h["validation_score"], default=None)
    successful = [h for h in history if h["status"] == "COMPLETE" and h.get("validation_score") is not None]
    if not successful:
        raise RuntimeError("no trading-replay-eligible iterations; inspect persisted trial metrics")
    baseline = successful[0]
    improvement = (float(best["validation_score"]) - float(baseline["validation_score"])
                   if best is not None and baseline is not None else None)
    return {"status": "ITERATIONS_COMPLETE", "strategy": strategy,
            "run_id": run_id, "iterations": len(history), "successful": sum(h["status"] == "COMPLETE" for h in history),
            "baseline_score": baseline["validation_score"] if baseline else None,
            "best_score": best["validation_score"] if best else None,
            "improvement_vs_first_successful": improvement,
            "best": best, "outer_validation_used": True, "holdout_used": False}


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
