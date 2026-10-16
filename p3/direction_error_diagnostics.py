"""Ex-post direction forecast scoring with fully matured labels only.

Research diagnostics never influence decisions at the same historical timestamp.
"""
import math


def diagnose_direction_predictions(predictions, candles, horizon_bars, research):
    start, end = research
    if type(horizon_bars) is not int or horizon_bars < 1:
        raise ValueError("invalid horizon")
    ordered = sorted(candles, key=lambda c: int(c["close_time"]))
    by_time = {int(c["close_time"]): i for i, c in enumerate(ordered)}
    if len(by_time) != len(ordered):
        raise ValueError("duplicate candle timestamps")
    matched = 0
    wrong = 0
    brier_sum = 0.0
    by_side = {"UP": {"count": 0, "wrong": 0},
               "DOWN": {"count": 0, "wrong": 0}}
    skipped = 0
    for prediction in predictions:
        t = int(prediction["decision_time_ms"])
        i = by_time.get(t)
        if i is None or not start <= t < end or i + horizon_bars >= len(ordered):
            skipped += 1
            continue
        future = ordered[i + horizon_bars]
        if int(future["close_time"]) >= end:
            skipped += 1
            continue
        p = float(prediction["probability_up"])
        reference = float(prediction["reference_price"])
        final = float(future["close"])
        if not all(math.isfinite(v) for v in (p, reference, final)) or not 0 <= p <= 1 or reference <= 0:
            skipped += 1
            continue
        actual_up = int(final > reference)
        predicted_up = p >= 0.5
        side = "UP" if predicted_up else "DOWN"
        error = int(predicted_up != bool(actual_up))
        matched += 1
        wrong += error
        brier_sum += (p - actual_up) ** 2
        by_side[side]["count"] += 1
        by_side[side]["wrong"] += error
    return {
        "status": "RESEARCH_DIRECTION_EVALUATION" if matched >= 5
                  else "INSUFFICIENT_DIRECTION_PREDICTION_EVIDENCE",
        "matched_predictions": matched,
        "skipped_predictions": skipped,
        "direction_error_rate_percent": 100 * wrong / matched if matched else None,
        "mean_brier_score": brier_sum / matched if matched else None,
        "by_predicted_direction": by_side,
        "independent_validation_performed": False,
        "limitations": "Ex-post direction forecast error; not causal proof or independent validation."
    }
