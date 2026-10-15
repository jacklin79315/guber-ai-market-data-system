"""One bounded research batch: 25 distinct validation-only model experiments.

Four strategy jobs yield 100 experiments. Final holdout is NEVER inspected.
No model activation, order placement, or automatic promotion.
"""
import hashlib
import itertools
import json
import os
from .ai_training_pipeline import train_horizon
from .ai_feature_history import load_native_features
from .native_history_replay import load_native_candles
from .multi_model_replay import STRATEGY_TIMEFRAMES
from .validation_selection import select_threshold
from .fee_schedule import load_fee_rate
from .training_settings import load_training_settings
from .iterative_generation import propose_generation
from .generation_evaluator import compare_current_generation
from .training_data_quality import validate_training_history

PARAMETERS = tuple(
    {"max_iter": iterations, "learning_rate": rate}
    for iterations, rate in itertools.product(
        (60, 100, 140, 180, 240),
        (0.025, 0.05, 0.075, 0.10, 0.15))
)
assert len(PARAMETERS) == 25


def rank_validation_trials(trials):
    """Only independent validation scores determine research ranking."""
    eligible = [t for t in trials if t.get("validation_eligible")]
    return sorted(eligible, key=lambda t: (
        -t["validation_score"], t["trial_index"]))


def choose_generation_parameters(db, symbol, strategy):
    generation = int(os.getenv("TRAINING_GENERATION", "1"))
    if generation == 1:
        return PARAMETERS
    if generation < 1:
        raise ValueError("invalid generation")
    parent_run = os.environ["TRAINING_PARENT_RUN_ID"]
    old_window = json.loads(os.environ["TRAINING_PARENT_VALIDATION_WINDOW"])
    new_window = json.loads(os.environ["TRAINING_CURRENT_VALIDATION_WINDOW"])
    if (not isinstance(old_window, list) or not isinstance(new_window, list)
            or len(old_window) != 2 or len(new_window) != 2
            or not all(isinstance(x, int) for x in old_window + new_window)
            or new_window[0] <= old_window[0]
            or new_window[1] <= old_window[1]):
        raise ValueError("validation window must advance chronologically")
    history = db("GET", "ai_training_batch_trials", {
        "select": "trial_index,status,validation_eligible,validation_score,params",
        "run_id": "eq." + parent_run, "symbol": "eq." + symbol,
        "strategy": "eq." + strategy, "order": "trial_index.asc",
        "limit": "100",
    })
    plan = propose_generation(history, current_validation_window=new_window,
                              previous_validation_window=old_window)
    print(json.dumps({"status": "GENERATION_PLAN", "strategy": strategy,
                      "generation": generation, "reason": plan["reason"],
                      "candidate_count": len(plan["candidates"])}), flush=True)
    return tuple(plan["candidates"])


def run_batch(db, *, symbol, strategy, years):
    if strategy not in STRATEGY_TIMEFRAMES:
        raise ValueError("unsupported training strategy")
    timeframe = STRATEGY_TIMEFRAMES[strategy]
    candles = load_native_candles(db, symbol, timeframe)
    features = load_native_features(db, symbol, timeframe)
    fee_rate = load_fee_rate(db)
    generation = int(os.getenv("TRAINING_GENERATION", "1"))
    from .ai_training_pipeline import _add_months, chronological_windows, DAY_MS
    if not candles:
        raise ValueError("no native candles for generation")
    end_ms = ((int(candles[-1]["close_time"]) + 1) // DAY_MS) * DAY_MS
    actual_window = chronological_windows(
        _add_months(end_ms, -12 * years), years=years)["validation"]
    # Both baseline and subsequent generations must use a fully closed window.
    from datetime import datetime, timezone
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    if actual_window[1] > now_ms:
        raise ValueError("validation window is not fully closed")
    quality = validate_training_history(
        candles, features, timeframe,
        required_start_ms=_add_months(end_ms, -12 * years))
    print(json.dumps({"status": "DATA_QUALITY", "strategy": strategy,
                      **quality}), flush=True)
    if generation == 1:
        previous_baseline = db("GET", "ai_training_generation_comparisons", {
            "select": "id", "symbol": "eq." + symbol, "strategy": "eq." + strategy,
            "generation": "eq.1",
            "validation_start_ms": "eq." + str(actual_window[0]),
            "validation_end_ms": "eq." + str(actual_window[1]), "limit": "1",
        })
        if previous_baseline:
            return {"status": "WAIT", "reason": "verified_baseline_already_exists"}
    if generation > 1:
        from .generation_readiness import generation_readiness
        requested = json.loads(os.environ["TRAINING_CURRENT_VALIDATION_WINDOW"])
        if list(actual_window) != requested:
            raise ValueError("native-candle validation window differs from requested window")
        previous = json.loads(os.environ["TRAINING_PARENT_VALIDATION_WINDOW"])
        existing = db("GET", "ai_training_generation_comparisons", {
            "select": "id", "symbol": "eq." + symbol, "strategy": "eq." + strategy,
            "validation_start_ms": "eq." + str(actual_window[0]),
            "validation_end_ms": "eq." + str(actual_window[1]), "limit": "1",
        })
        parent_run = os.environ["TRAINING_PARENT_RUN_ID"]
        parent_rows = db("GET", "ai_training_batch_trials", {
            "select": "status,validation_eligible,validation_start_ms,validation_end_ms", "run_id": "eq." + parent_run,
            "symbol": "eq." + symbol, "strategy": "eq." + strategy, "limit": "100",
        })
        verified_parent = (len(parent_rows) == 25 and all(
            x.get("validation_start_ms") == previous[0] and
            x.get("validation_end_ms") == previous[1] for x in parent_rows))
        readiness = generation_readiness(
            latest_run_complete=(verified_parent and
                                 all(x["status"] == "COMPLETE" for x in parent_rows)),
            current_window=list(actual_window), previous_window=previous,
            parent_eligible=any(x.get("validation_eligible") is True for x in parent_rows),
            already_evaluated=bool(existing), next_generation=generation)
        if readiness["status"] != "READY":
            print(json.dumps({"status": "GENERATION_WAIT", "strategy": strategy,
                              "reason": readiness["reason"]}), flush=True)
            return readiness
    params_grid = choose_generation_parameters(db, symbol, strategy)
    if not params_grid:
        return {'status': 'WAIT', 'reason': 'no_safe_next_generation'}
    trials = []
    run_id = os.getenv("GITHUB_RUN_ID", "local-research")
    for i, params in enumerate(params_grid, start=1):
        trial_key = hashlib.sha256(json.dumps(
            [symbol, strategy, years, params], sort_keys=True).encode()).hexdigest()
        record = {"trial_index": i, "trial_key": trial_key,
                  "strategy": strategy, "symbol": symbol,
                  "lookback_years": years, "params": params,
                  "research_only": True, "auto_promote": False}
        db("POST", "ai_training_batch_trials", {"on_conflict": "run_id,strategy,trial_index"}, [{
            "run_id": run_id, "symbol": symbol, "strategy": strategy,
            "timeframe": timeframe, "lookback_years": years,
            "trial_index": i, "status": "RUNNING", "params": params,
            "validation_start_ms": actual_window[0],
            "validation_end_ms": actual_window[1],
        }], {"Prefer": "resolution=merge-duplicates,return=minimal"})
        print(json.dumps({"status": "TRIAL_STARTED", **record}), flush=True)
        winner = None
        try:
            trained = train_horizon(features, candles, strategy,
                                    years=years, model_params=params)
            if int(os.getenv("TRAINING_GENERATION", "1")) > 1:
                actual_window = list(trained["windows"]["validation"])
                requested_window = json.loads(os.environ["TRAINING_CURRENT_VALIDATION_WINDOW"])
                if actual_window != requested_window:
                    raise ValueError("actual validation window differs from requested generation window")
            selection = select_threshold(
                candles, features, trained["model"], symbol,
                trained["windows"]["validation"], fee_rate)
            candidates = [c for c in selection["candidates"] if c["eligible"]]
            winner = next((c for c in candidates
                           if c["threshold"] == selection["selected_threshold"]), None)
            record.update({
                "status": "COMPLETE",
                "validation_eligible": winner is not None,
                "validation_score": (winner["return_percent"] - winner["drawdown_percent"])
                                    if winner else None,
                "selected_threshold": selection["selected_threshold"],
                "validation_candidates": selection["candidates"],
                "training_samples": trained["coverage"]["train"]["samples"],
                "validation_samples": trained["coverage"]["validation"]["samples"],
                "validation_window": trained["windows"]["validation"],
                "holdout_evaluated": False,
            })
        except Exception as exc:
            # An experiment failure is recorded; do not pretend it succeeded.
            record.update({"status": "FAILED", "validation_eligible": False,
                           "error": str(exc), "holdout_evaluated": False})
        winner = winner if record["status"] == "COMPLETE" else None
        db("POST", "ai_training_batch_trials", {"on_conflict": "run_id,strategy,trial_index"}, [{
            "run_id": run_id, "symbol": symbol, "strategy": strategy,
            "timeframe": timeframe, "lookback_years": years,
            "trial_index": i, "status": record["status"], "params": params,
            "validation_start_ms": actual_window[0],
            "validation_end_ms": actual_window[1],
            "validation_eligible": record["validation_eligible"],
            "validation_score": record.get("validation_score"),
            "validation_return_percent": winner["return_percent"] if winner else None,
            "validation_drawdown_percent": winner["drawdown_percent"] if winner else None,
            "validation_trades": winner["closed_trades"] if winner else None,
            "selected_threshold": record.get("selected_threshold"),
            "training_samples": record.get("training_samples"),
            "validation_samples": record.get("validation_samples"),
            "error_reason": record.get("error"),
            "completed_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        }], {"Prefer": "resolution=merge-duplicates,return=minimal"})
        trials.append(record)
        print(json.dumps({"status": "TRIAL_RESULT", **record}, allow_nan=False), flush=True)
    ranking = rank_validation_trials(trials)
    comparison = compare_current_generation(db, symbol=symbol, strategy=strategy,
        years=years, candles=candles, features=features, fee_rate=fee_rate,
        ranking=ranking)
    db("POST", "ai_training_generation_comparisons",
       {"on_conflict": "run_id,strategy"}, [{
           "run_id": run_id, "parent_run_id": os.getenv("TRAINING_PARENT_RUN_ID"),
           "symbol": symbol, "strategy": strategy,
           "generation": generation,
           "validation_start_ms": actual_window[0],
           "validation_end_ms": actual_window[1],
           "status": comparison["status"], "reason": comparison.get("reason"),
           "comparison": comparison,
       }], {"Prefer": "resolution=merge-duplicates,return=minimal"})
    print(json.dumps({'status': 'GENERATION_COMPARISON', 'strategy': strategy,
                      'comparison': comparison}, allow_nan=False), flush=True)
    if int(os.getenv("TRAINING_GENERATION", "1")) > 1 and all(t["status"] == "FAILED" for t in trials):
        raise RuntimeError("all next-generation experiments failed; refusing green workflow")
    summary = {"status": "BATCH_COMPLETE", "symbol": symbol, "strategy": strategy,
               "lookback_years": years, "requested_trials": len(params_grid),
               "completed_trials": sum(t["status"] == "COMPLETE" for t in trials),
               "failed_trials": sum(t["status"] == "FAILED" for t in trials),
               "eligible_trials": len(ranking),
               "best_trial": ranking[0] if ranking else None,
               "holdout_evaluated": False, "auto_promote": False,
               "generation_comparison": comparison}
    print(json.dumps(summary, allow_nan=False), flush=True)
    return summary


def main():
    from collector import db
    settings = load_training_settings(db)
    strategy = os.environ["TRAINING_BATCH_STRATEGY"]
    run_batch(db, symbol=settings["symbol"], strategy=strategy,
              years=settings["years"])


if __name__ == "__main__":
    main()
