"""Research-only, chronological learner for settled paper exploration records.

This module never promotes a model, places orders, or updates the database.
Fit uses only records whose outcomes were known by the next decision time.
"""
from math import isfinite
import numpy as np
from sklearn.linear_model import Ridge


def _vector(record, feature_names):
    features = record.get("signal_features", {})
    values = [features.get(name) for name in feature_names]
    if any(isinstance(v, bool) or not isinstance(v, (int, float))
           or not isfinite(v) for v in values):
        return None
    return [float(v) for v in values]


def chronological_paper_learning(records, feature_names, *, min_train=10, alpha=10.0):
    """Return prequential predictions: train strictly on previously SETTLED trades.

    Rows are evaluated at signal time. Same-time LONG/SHORT decisions never
    see each other's labels. Metrics describe predictions, not trading returns.
    """
    if not feature_names or min_train < 2 or alpha <= 0:
        raise ValueError("invalid training configuration")
    ordered = sorted(records, key=lambda r: (r["signal_time_ms"], r["direction"]))
    seen = set()
    evaluated = []
    for row in ordered:
        t = row["signal_time_ms"]
        key = (t, row["direction"])
        if key in seen:
            raise ValueError("duplicate training example")
        seen.add(key)
        x = _vector(row, feature_names)
        if x is None:
            continue
        eligible = [
            prior for prior in ordered
            if prior["label_end_ms"] < t
            and prior["signal_time_ms"] < t
            and _vector(prior, feature_names) is not None
            and isinstance(prior.get("net_r"), (int, float))
            and not isinstance(prior["net_r"], bool)
            and isfinite(prior["net_r"])
        ]
        if len(eligible) < min_train:
            continue
        xs = np.array([_vector(prior, feature_names) for prior in eligible], dtype=float)
        ys = np.array([prior["net_r"] for prior in eligible], dtype=float)
        # Normalize using training-only statistics; no test-row fitting.
        mean, std = xs.mean(axis=0), xs.std(axis=0)
        std[std == 0] = 1.0
        model = Ridge(alpha=alpha).fit((xs - mean) / std, ys)
        prediction = float(model.predict((np.array([x]) - mean) / std)[0])
        baseline_prediction = float(ys.mean())
        evaluated.append({"signal_time_ms": t, "direction": row["direction"],
                          "prediction_net_r": prediction,
                          "baseline_prediction_net_r": baseline_prediction,
                          "actual_net_r": row["net_r"],
                          "train_count": len(eligible),
                          "training_latest_label_end_ms": max(
                              prior["label_end_ms"] for prior in eligible)})
    errors = [v["prediction_net_r"] - v["actual_net_r"] for v in evaluated]
    baseline_errors = [v["baseline_prediction_net_r"] - v["actual_net_r"] for v in evaluated]
    model_mae = sum(abs(e) for e in errors) / len(errors) if errors else None
    baseline_mae = sum(abs(e) for e in baseline_errors) / len(baseline_errors) if baseline_errors else None
    return {"research_only": True, "auto_trade_enabled": False,
            "model": "ridge_baseline_v1", "min_train": min_train,
            "prediction_count": len(evaluated),
            "mean_absolute_error_r": model_mae,
            "baseline_mean_absolute_error_r": baseline_mae,
            "mae_improvement_r": baseline_mae - model_mae if errors else None,
            "outperforms_baseline_mae": model_mae < baseline_mae if errors else None,
            "predictions": evaluated}
