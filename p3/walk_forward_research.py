"""Point-in-time boundaries for the approved 24-month trading research period.

This module is a guard for the new walk-forward engine, not a claim that
legacy 16/4/4 training has been replaced. Independent evaluation starts
after the research period and must not be used for candidate selection.
"""
from .ai_training_pipeline import _add_months, DAY_MS


def research_window(holdout_start_ms, *, months=24):
    """Return a closed research interval before independent holdout.

    The caller must supply the independent holdout boundary explicitly.
    Never derive it from the end of the training data or overlap holdout.
    """
    if type(months) is not int or months < 1 or months > 24:
        raise ValueError("research duration must be an integer from 1 to 24 months")
    if not isinstance(holdout_start_ms, int) or isinstance(holdout_start_ms, bool):
        raise TypeError("holdout_start_ms must be an integer UTC millisecond timestamp")
    if holdout_start_ms <= 0 or holdout_start_ms % DAY_MS:
        raise ValueError("holdout boundary must be a positive UTC day boundary")
    start = _add_months(holdout_start_ms, -months)
    return (start, holdout_start_ms)


def check_research_coverage(candles, features, research, *, timeframe):
    """Fail closed if native candles/features do not cover the whole interval.

    This is a boundary check, not a substitute for continuity/quality checks.
    """
    interval = {"15m": 900000, "1h": 3600000, "4h": 14400000,
                "1d": DAY_MS}.get(timeframe)
    if interval is None:
        raise ValueError("unsupported native timeframe")
    start, end = research
    if not candles or not features:
        raise ValueError("missing research candles or features")
    # Native Binance close_time is inclusive: bar ending at UTC boundary
    # has close_time = boundary - 1 ms. Require every expected bar, not
    # just matching counts (which can hide internal gaps).
    expected = set(range(start + interval - 1, end, interval))
    candle_times = {int(c["close_time"]) for c in candles
                    if start <= int(c["close_time"]) < end}
    feature_times = {int(f["close_time"]) for f in features
                     if start <= int(f["close_time"]) < end}
    missing_candles = expected - candle_times
    missing_features = expected - feature_times
    unexpected_candles = candle_times - expected
    unexpected_features = feature_times - expected
    if (missing_candles or missing_features or unexpected_candles
            or unexpected_features):
        raise ValueError(
            f"invalid native continuity/alignment: timeframe={timeframe}, "
            f"expected={len(expected)}, missing_candles={len(missing_candles)}, "
            f"missing_features={len(missing_features)}, "
            f"unexpected_candles={len(unexpected_candles)}, "
            f"unexpected_features={len(unexpected_features)}")

    return {"research_start_ms": start, "research_end_ms": end,
            "native_candles": len(candle_times),
            "matched_features": len(candle_times & feature_times)}
