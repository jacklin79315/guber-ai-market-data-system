"""Post-replay forecast evaluation. Never fed into point-in-time decisions.

Only completed future horizons within the research window are scored.
"""
import math


def diagnose_price_range_predictions(predictions, candles, horizon_bars, research):
    start, end = research
    if type(horizon_bars) is not int or horizon_bars < 1:
        raise ValueError("invalid horizon")
    ordered = sorted(candles, key=lambda c: int(c["close_time"]))
    by_time = {int(c["close_time"]): i for i, c in enumerate(ordered)}
    if len(by_time) != len(ordered):
        raise ValueError("duplicate candle timestamps")
    errors = []
    upside_errors = []
    downside_errors = []
    skipped = 0
    for record in predictions:
        t = int(record["decision_time_ms"])
        i = by_time.get(t)
        if i is None or not start <= t < end or i + horizon_bars >= len(ordered):
            skipped += 1
            continue
        future = ordered[i + 1:i + horizon_bars + 1]
        if int(future[-1]["close_time"]) >= end:
            skipped += 1
            continue
        price = float(record["reference_price"])
        upper = float(record["predicted_upper_bound"])
        lower = float(record["predicted_lower_bound"])
        if not all(math.isfinite(v) for v in (price, upper, lower)) or price <= 0:
            skipped += 1
            continue
        actual_up = max(float(c["high"]) for c in future) / price - 1
        actual_down = 1 - min(float(c["low"]) for c in future) / price
        predicted_up = upper / price - 1
        predicted_down = 1 - lower / price
        if not all(math.isfinite(v) for v in (actual_up, actual_down)):
            skipped += 1
            continue
        upside_errors.append(abs(predicted_up - actual_up))
        downside_errors.append(abs(predicted_down - actual_down))
        errors.append((upside_errors[-1] + downside_errors[-1]) / 2)
    n = len(errors)
    return {
        "status": "RESEARCH_FORECAST_EVALUATION" if n >= 5
                  else "INSUFFICIENT_STRUCTURE_PREDICTION_EVIDENCE",
        "matched_predictions": n,
        "skipped_predictions": skipped,
        "mean_absolute_range_error": sum(errors) / n if n else None,
        "mean_absolute_upside_error": sum(upside_errors) / n if n else None,
        "mean_absolute_downside_error": sum(downside_errors) / n if n else None,
        "independent_validation_performed": False,
        "limitations": "Ex-post research forecast error; not a causal attribution or holdout."
    }
