"""Research-only, chronological learner for settled paper exploration records.

This module never promotes a model, places orders, or updates the database.
Fit uses only records whose outcomes were known by the next decision time.
"""
from math import isfinite
from bisect import bisect_left
import numpy as np
from sklearn.linear_model import Ridge


def _vector(record, feature_names):
    features = record.get("signal_features", {})
    values = [features.get(name) for name in feature_names]
    if any(isinstance(v, bool) or not isinstance(v, (int, float))
           or not isfinite(v) for v in values):
        return None
    direction = record.get("direction")
    if direction not in ("LONG", "SHORT"):
        return None
    return [float(v) for v in values] + [1.0 if direction == "LONG" else -1.0]


def chronological_paper_learning(records, feature_names, *, min_train=10, alpha=10.0,
                                 evaluation_start_ms=None):

    """Return prequential predictions: train strictly on previously SETTLED trades.

    Direction is an explicit input feature, allowing different LONG/SHORT forecasts.\n    Rows are evaluated at signal time. Same-time LONG/SHORT decisions never
    see each other's labels. Metrics describe predictions, not trading returns.
    """
    if not feature_names or min_train < 2 or alpha <= 0:
        raise ValueError("invalid training configuration")
    ordered = sorted(records, key=lambda r: (r["signal_time_ms"], r["direction"]))
    seen = set()
    valid = []
    for row in ordered:
        t = row["signal_time_ms"]
        key = (t, row["direction"])
        if key in seen:
            raise ValueError("duplicate training example")
        seen.add(key)
        x = _vector(row, feature_names)
        y = row.get("net_r")
        if (x is not None and isinstance(y, (int, float))
                and not isinstance(y, bool) and isfinite(y)):
            valid.append((row, x, float(y)))
    # Index settled labels once. A label may enter the training set only
    # strictly AFTER its settlement time, never at or before it.
    by_settlement = sorted(valid, key=lambda v: v[0]["label_end_ms"])
    settlement_times = [v[0]["label_end_ms"] for v in by_settlement]
    evaluated = []
    for row, x, _ in valid:
        t = row["signal_time_ms"]
        if evaluation_start_ms is not None and t < evaluation_start_ms:
            continue
        boundary = bisect_left(settlement_times, t)
        eligible = [v for v in by_settlement[:boundary]
                    if v[0]["signal_time_ms"] < t]
        if len(eligible) < min_train:
            continue
        xs = np.array([v[1] for v in eligible], dtype=float)
        ys = np.array([v[2] for v in eligible], dtype=float)
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
                          "label_end_ms": row["label_end_ms"],
                          "train_count": len(eligible),
                          "training_latest_label_end_ms": max(
                              v[0]["label_end_ms"] for v in eligible)})
    errors = [v["prediction_net_r"] - v["actual_net_r"] for v in evaluated]
    baseline_errors = [v["baseline_prediction_net_r"] - v["actual_net_r"] for v in evaluated]
    model_mae = sum(abs(e) for e in errors) / len(errors) if errors else None
    baseline_mae = sum(abs(e) for e in baseline_errors) / len(baseline_errors) if baseline_errors else None
    return {"research_only": True, "auto_trade_enabled": False,
            "model": "ridge_baseline_v1", "min_train": min_train,
            "prediction_count": len(evaluated),
            "evaluation_start_ms": evaluation_start_ms,
            "available_training_observation_count": len(ordered),
            "mean_absolute_error_r": model_mae,
            "baseline_mean_absolute_error_r": baseline_mae,
            "mae_improvement_r": baseline_mae - model_mae if errors else None,
            "outperforms_baseline_mae": model_mae < baseline_mae if errors else None,
            "predictions": evaluated}


def chronological_direction_decisions(predictions):
    """Evaluate paper-only LONG/SHORT/WAIT choices using as-of predictions.

    Decisions compare paired forecasts at the same timestamp. An unpaired
    timestamp remains WAIT. The actual outcome is read only for post-hoc
    scoring, never for direction selection. This is not an execution engine.
    """
    grouped = {}
    for row in predictions:
        grouped.setdefault(row["signal_time_ms"], {})[row["direction"]] = row
    decisions = []
    occupied_until = None
    for t, pair in sorted(grouped.items()):
        long, short = pair.get("LONG"), pair.get("SHORT")
        if long is None or short is None:
            decisions.append({"signal_time_ms": t, "decision": "WAIT",
                              "reason": "missing_paired_prediction"})
            continue
        lv, sv = long["prediction_net_r"], short["prediction_net_r"]
        direction = "LONG" if lv > 0 and lv > sv else (
            "SHORT" if sv > 0 and sv > lv else "WAIT")
        selected = pair.get(direction)
        if selected and occupied_until is not None and t < occupied_until:
            direction, selected = "WAIT", None
            reason = "existing_paper_position"
        else:
            reason = "positive_best_prediction" if selected else "nonpositive_or_tied"
        if selected:
            occupied_until = selected["label_end_ms"]
        decisions.append({
            "signal_time_ms": t, "decision": direction,
            "predicted_long_net_r": lv, "predicted_short_net_r": sv,
            "realized_selected_net_r": selected["actual_net_r"] if selected else None,
            "reason": reason,
        })
    paired = [x for x in decisions if "predicted_long_net_r" in x]
    positive = [x for x in paired if max(x["predicted_long_net_r"], x["predicted_short_net_r"]) > 0]
    trades = [x["realized_selected_net_r"] for x in decisions if x["decision"] != "WAIT"]
    wins = [v for v in trades if v > 0]
    losses = [v for v in trades if v < 0]
    equity, peak, max_drawdown = 0.0, 0.0, 0.0
    for value in trades:
        equity += value
        peak = max(peak, equity)
        max_drawdown = max(max_drawdown, peak - equity)
    gross_profit = sum(wins)
    gross_loss = -sum(losses)
    return {"research_only": True, "auto_trade_enabled": False,
            "realized_total_net_r": sum(trades),
            "realized_win_rate": len(wins) / len(trades) if trades else None,
            "max_closed_trade_drawdown_r": max_drawdown if trades else None,
            "profit_factor": gross_profit / gross_loss if gross_loss else None,
            "decision_count": len(decisions),
            "paired_prediction_count": len(paired),
            "positive_forecast_count": len(positive),
            "max_predicted_net_r": max((max(x["predicted_long_net_r"], x["predicted_short_net_r"]) for x in paired), default=None),
            "mean_best_predicted_net_r": sum(max(x["predicted_long_net_r"], x["predicted_short_net_r"]) for x in paired) / len(paired) if paired else None,
            "wait_reason_counts": {reason: sum(x["decision"] == "WAIT" and x["reason"] == reason for x in decisions) for reason in ("missing_paired_prediction", "nonpositive_or_tied", "existing_paper_position")},
            "long_count": sum(x["decision"] == "LONG" for x in decisions),
            "short_count": sum(x["decision"] == "SHORT" for x in decisions),
            "wait_count": sum(x["decision"] == "WAIT" for x in decisions),
            "realized_selected_count": len(trades),
            "realized_selected_mean_net_r": sum(trades) / len(trades) if trades else None,
            "decisions": decisions}
