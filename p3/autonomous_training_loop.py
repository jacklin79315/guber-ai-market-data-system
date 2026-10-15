"""Sequential autonomous learning on historical indicator combinations.

Each iteration fits the existing HorizonModel on an earlier training slice and
scores it on a later slice. The outer validation/holdout partitions are not
used to choose parameters. Candidate choice uses the preceding outcomes.
"""
import json
import os
import numpy as np
from .ai_decision_model import HorizonModel, HORIZON_BARS, build_supervised_examples
from .ai_training_pipeline import _add_months, chronological_windows, DAY_MS
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
    # All optimization samples are strictly inside the outer training period.
    X, y, up, down, times = build_supervised_examples(
        features, candles, HORIZON_BARS[strategy])
    interval = {"15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000}[timeframe]
    valid = np.array([train_begin <= t and t + HORIZON_BARS[strategy] * interval < train_end
                      for t in times])
    X, y, up, down = X[valid], y[valid], up[valid], down[valid]
    minimum = max(160, int(110 / 0.65) + HORIZON_BARS[strategy] * 2)
    if len(X) < minimum:
        raise ValueError(f"insufficient training-only samples: {len(X)} < {minimum}")
    # Two forward-only folds work even for the lower-frequency daily series.
    boundaries = [int(len(X) * f) for f in (0.65, 0.82, 1.0)]
    history = []
    # The existing 25-candidate grid is reused as the initial search space.
    # For longer runs, a new local grid is generated around the best candidate.
    candidates = list(PARAMETERS)
    candidates.extend(
        {"max_iter": steps, "learning_rate": round(rate / 1000, 5)}
        for steps in range(40, 341, 20)
        for rate in range(15, 186, 10))
    for index in range(iterations):
        params = next_candidate(candidates, history)
        if params is None:
            best = max((h for h in history if h["status"] == "COMPLETE"),
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
        scores = []
        error = None
        for j in range(2):
            train_stop = boundaries[j]
            eval_stop = boundaries[j + 1]
            # Purge labels that would overlap the next evaluation segment.
            train_stop = max(0, train_stop - HORIZON_BARS[strategy])
            try:
                model = HorizonModel(**params).fit(
                    X[:train_stop], y[:train_stop], up[:train_stop], down[:train_stop])
                prob = model.direction.predict_proba(X[boundaries[j]:eval_stop])[:, 1]
                truth = y[boundaries[j]:eval_stop]
                if len(truth) == 0:
                    raise ValueError("empty evaluation fold")
                # Brier score evaluates probabilistic direction, not trade returns.
                scores.append(float(1 - np.mean((prob - truth) ** 2)))
            except Exception as exc:
                error = str(exc)
                break
        result = {"trial_index": index + 1, "params": params,
                  "status": "COMPLETE" if error is None else "FAILED",
                  "validation_eligible": error is None,
                  "validation_score": float(np.mean(scores)) if error is None else None,
                  "fold_scores": scores, "error": error}
        history.append(result)
        print(json.dumps({"status": "ITERATION_RESULT", "strategy": strategy,
                          **result}, allow_nan=False), flush=True)
    best = max((h for h in history if h["status"] == "COMPLETE"),
               key=lambda h: h["validation_score"], default=None)
    successful = [h for h in history if h["status"] == "COMPLETE"]
    baseline = successful[0] if successful else None
    improvement = (float(best["validation_score"]) - float(baseline["validation_score"])
                   if best is not None and baseline is not None else None)
    return {"status": "ITERATIONS_COMPLETE", "strategy": strategy,
            "iterations": len(history), "successful": sum(h["status"] == "COMPLETE" for h in history),
            "baseline_score": baseline["validation_score"] if baseline else None,
            "best_score": best["validation_score"] if best else None,
            "improvement_vs_first_successful": improvement,
            "best": best, "outer_validation_used": False, "holdout_used": False}


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
