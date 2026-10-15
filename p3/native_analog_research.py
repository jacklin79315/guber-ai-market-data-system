"""Research-only end-to-end run against native Supabase snapshots.

Does not train, write database records, promote a model, or place orders.
The database transport must implement db("GET", table, query_params).
"""
from math import isfinite
from .analog_data_loader import DEFAULT_FEATURES, load_research_history
from .analog_research_pipeline import research_analog_plan
from .raw_candle_adapter import INTERVAL_MS


def run_native_analog_research(db, *, symbol, timeframe, asof_ms,
                               stop_pct, target_pct, max_holding_bars,
                               fee_rate, slippage_rate, features=DEFAULT_FEATURES,
                               k=100, min_samples=30, embargo_ms=0):
    if timeframe not in INTERVAL_MS:
        raise ValueError("unsupported native timeframe")
    if not isinstance(max_holding_bars, int) or isinstance(max_holding_bars, bool) or max_holding_bars < 1:
        raise ValueError("invalid holding period")
    # Only a completed native candle can be queried.
    history = load_research_history(db, symbol, timeframe, asof_ms=asof_ms,
                                    features=features)
    candles, snapshots = history["candles"], history["snapshots"]
    if not candles or not snapshots:
        return {"status": "INSUFFICIENT_DATA", "symbol": symbol,
                "timeframe": timeframe, "research_only": True}
    candle_closes = {c["close_time"] for c in candles}
    if any(s["timestamp_ms"] not in candle_closes for s in snapshots):
        raise ValueError("feature/native candle timestamps are not aligned")
    # The newest snapshot is the query. It must be a completed native candle.
    current = snapshots[-1]
    if any(isinstance(current.get(f), bool) or
           not isinstance(current.get(f), (int, float)) or
           not isfinite(current[f]) for f in features):
        return {"status": "INCOMPLETE_CURRENT_FEATURES", "symbol": symbol,
                "timeframe": timeframe, "research_only": True}
    horizon_ms = max_holding_bars * INTERVAL_MS[timeframe]
    # Keep only fully formed historical feature vectors; no imputation.
    usable = [s for s in snapshots[:-1]
              if all(isinstance(s.get(f), (int, float)) and
                     not isinstance(s[f], bool) and isfinite(s[f])
                     for f in features)]
    results = {}
    for direction in ("LONG", "SHORT"):
        results[direction] = research_analog_plan(
            current, usable, candles, features,
            asof_ms=current["timestamp_ms"], horizon_ms=horizon_ms,
            direction=direction, stop_pct=stop_pct, target_pct=target_pct,
            max_holding_bars=max_holding_bars, fee_rate=fee_rate,
            slippage_rate=slippage_rate, embargo_ms=embargo_ms,
            k=k, min_samples=min_samples)
    return {"status": "RESEARCH_COMPLETE", "symbol": symbol,
            "timeframe": timeframe, "asof_ms": current["timestamp_ms"],
            "feature_count": history["feature_count"],
            "candle_count": history["candle_count"],
            "usable_history_count": len(usable),
            "plan": {"stop_pct": stop_pct, "target_pct": target_pct,
                     "max_holding_bars": max_holding_bars,
                     "fee_rate": fee_rate, "slippage_rate": slippage_rate},
            "LONG": results["LONG"], "SHORT": results["SHORT"],
            "research_only": True, "auto_trade_enabled": False}
