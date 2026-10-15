"""Strict native-candle and point-in-time feature integrity preflight."""
import math
from .ai_decision_model import FEATURE_COLUMNS

INTERVALS = {"15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000}


def validate_training_history(candles, features, timeframe, *, required_start_ms):
    if timeframe not in INTERVALS:
        raise ValueError("unsupported timeframe")
    if not candles or not features:
        raise ValueError("empty training history")
    interval = INTERVALS[timeframe]
    by_close = {}
    previous = None
    for candle in candles:
        t = int(candle["close_time"])
        if previous is not None and t - previous != interval:
            raise ValueError("missing, duplicate or unordered native candle")
        if int(candle["open_time"]) + interval - 1 != t:
            raise ValueError("native candle duration mismatch")
        if not all(math.isfinite(float(candle[k])) for k in ("open", "high", "low", "close")):
            raise ValueError("non-finite candle price")
        if min(float(candle["open"]), float(candle["close"]), float(candle["low"])) <= 0:
            raise ValueError("nonpositive candle price")
        if float(candle["high"]) < max(float(candle["open"]), float(candle["close"]), float(candle["low"])):
            raise ValueError("invalid candle high")
        by_close[t] = float(candle["close"])
        previous = t
    if int(candles[0]["open_time"]) > required_start_ms:
        raise ValueError("native history does not cover requested start")
    last_feature = None
    matched = 0
    for row in features:
        t = int(row["close_time"])
        if last_feature is not None and t <= last_feature:
            raise ValueError("duplicate or unordered features")
        last_feature = t
        if t < required_start_ms:
            continue
        if t not in by_close:
            raise ValueError("feature timestamp absent from native candles")
        if not math.isclose(float(row["close_price"]), by_close[t], rel_tol=1e-8):
            raise ValueError("feature price differs from native candle")
        if any(row.get(k) is None or not math.isfinite(float(row[k])) for k in FEATURE_COLUMNS):
            raise ValueError("missing or non-finite model feature")
        matched += 1
    # Technical indicators need a warm-up period. Accept a contiguous prefix
    # without features, but never accept a gap after the first feature row.
    usable = [int(row["close_time"]) for row in features if int(row["close_time"]) >= required_start_ms]
    if not usable:
        raise ValueError("no usable features inside training horizon")
    first = usable[0]
    expected = sum(1 for c in candles if int(c["close_time"]) >= first)
    if matched != expected:
        raise ValueError("missing feature rows inside training horizon")
    return {"status": "PASS", "matched": matched, "timeframe": timeframe,
            "first_usable_feature_ms": first}
