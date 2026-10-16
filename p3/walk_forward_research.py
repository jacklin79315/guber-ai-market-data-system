"""Point-in-time boundaries for the approved 24-month trading research period.

This module is a guard for the new walk-forward engine, not a claim that
legacy 16/4/4 training has been replaced. Independent evaluation starts
after the research period and must not be used for candidate selection.
"""
from .ai_training_pipeline import _add_months, DAY_MS


def research_window(holdout_start_ms, *, months=24):
    """Return the closed 24-month research interval before independent holdout.

    The caller must supply the independent holdout boundary explicitly.
    Never derive it from the end of the training data or overlap holdout.
    """
    if months != 24:
        raise ValueError("approved research duration is 24 months")
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
    candle_times = {int(c["close_time"]) for c in candles
                    if start <= int(c["close_time"]) < end}
    feature_times = {int(f["close_time"]) for f in features
                     if start <= int(f["close_time"]) < end}
    expected = (end - start) // interval
    if len(candle_times) < expected - 1 or len(feature_times) < expected - 1:
        raise ValueError(
            f"insufficient 24-month native coverage: timeframe={timeframe}, "
            f"expected~{expected}, candles={len(candle_times)}, "
            f"features={len(feature_times)}")
    if len(candle_times & feature_times) < expected - 1:
        raise ValueError("research candle/feature timestamps are not aligned")
    return {"research_start_ms": start, "research_end_ms": end,
            "native_candles": len(candle_times),
            "matched_features": len(candle_times & feature_times)}
