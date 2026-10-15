"""Historical fixed-plan outcome labels from closed native OHLC candles.

Research only. Signal features must be computed at signal_close_ms; entry is
the NEXT native candle open. A same-bar TP+SL collision is scored as SL.
"""
from math import isfinite


def _price(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or value <= 0:
        raise ValueError("invalid " + name)
    return float(value)


def label_fixed_plan(candles, *, signal_close_ms, direction, stop_pct,
                     target_pct, max_holding_bars, fee_rate=0.0,
                     slippage_rate=0.0):
    """Return realized net R and label end time, or None if future bars unavailable.

    stop_pct and target_pct are fractions of entry price. Transaction cost is
    charged for both entry and exit notionals, with adverse slippage on each.
    Gaps through stop are filled at worse opening price. Targets fill at their
    limit or better opening price, conservatively at the target.
    """
    if direction not in ("LONG", "SHORT") or not isinstance(max_holding_bars, int) or max_holding_bars < 1:
        raise ValueError("invalid trade plan")
    stop_pct = _price(stop_pct, "stop_pct")
    target_pct = _price(target_pct, "target_pct")
    if stop_pct >= 1 or target_pct >= 10:
        raise ValueError("unreasonable barriers")
    if not 0 <= fee_rate < 1 or not 0 <= slippage_rate < 1:
        raise ValueError("invalid costs")
    from .candle_execution import _validate_candle
    ordered = sorted(candles, key=lambda x: x["open_time"])
    if len(ordered) != len({x["open_time"] for x in ordered}):
        raise ValueError("duplicate candle")
    eligible = [c for c in ordered if c["open_time"] > signal_close_ms]
    if len(eligible) < max_holding_bars:
        return None
    bars = eligible[:max_holding_bars]
    for i, candle in enumerate(bars):
        _validate_candle(candle)
        if i and bars[i-1]["close_time"] >= candle["open_time"]:
            raise ValueError("overlapping candles")
    entry = _price(bars[0]["open"], "entry")
    sign = 1 if direction == "LONG" else -1
    stop = entry * (1 - sign * stop_pct)
    target = entry * (1 + sign * target_pct)
    reason, exit_price, exit_time = "TIME_LIMIT", bars[-1]["close"], bars[-1]["close_time"]
    for candle in bars:
        o, h, l = candle["open"], candle["high"], candle["low"]
        hit_stop = l <= stop if sign == 1 else h >= stop
        hit_target = h >= target if sign == 1 else l <= target
        gap_stop = o <= stop if sign == 1 else o >= stop
        if gap_stop or hit_stop:
            reason, exit_price, exit_time = "SL", (o if gap_stop else stop), candle["close_time"]
            break
        if hit_target:
            reason, exit_price, exit_time = "TP", target, candle["close_time"]
            break
    exit_price = float(exit_price)
    # Apply adverse slippage on both legs, then fees on actual notionals.
    entry_fill = entry * (1 + sign * slippage_rate)
    exit_fill = exit_price * (1 - sign * slippage_rate)
    gross = sign * (exit_fill - entry_fill)
    fees = fee_rate * (entry_fill + exit_fill)
    net_r = (gross - fees) / (entry * stop_pct)
    return {"net_r": net_r, "label_end_ms": exit_time, "exit_reason": reason,
            "entry_price": entry_fill, "exit_price": exit_fill,
            "ambiguous_bar": reason == "SL" and any(
                (c["low"] <= stop and c["high"] >= target)
                for c in bars if c["close_time"] == exit_time)}


def build_historical_outcomes(signals, candles, *, direction, stop_pct,
                              target_pct, max_holding_bars, fee_rate=0.0,
                              slippage_rate=0.0):
    """Label past feature snapshots without modifying or filtering features."""
    outcomes = {}
    for signal in signals:
        t = signal["timestamp_ms"]
        if t in outcomes:
            raise ValueError("duplicate signal timestamp")
        outcome = label_fixed_plan(
            candles, signal_close_ms=t, direction=direction, stop_pct=stop_pct,
            target_pct=target_pct, max_holding_bars=max_holding_bars,
            fee_rate=fee_rate, slippage_rate=slippage_rate)
        if outcome is not None:
            outcomes[t] = outcome
    return outcomes
