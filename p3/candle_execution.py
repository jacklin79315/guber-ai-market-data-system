"""P3B OHLC exit evaluator. Uses only *closed native* candles.

If both stop and target are reached in one candle, try native lower-timeframe
candles in chronological order; if still ambiguous, stop wins conservatively.
No synthetic candle resampling or signal generation.
"""
from .paper_engine import PaperAccount, _positive


def _validate_candle(candle):
    for key in ("open_time", "close_time", "open", "high", "low", "close"):
        if key not in candle:
            raise ValueError(f"missing {key}")
    o, h, l, c = (_positive(candle[k], k) for k in ("open", "high", "low", "close"))
    if not (l <= o <= h and l <= c <= h):
        raise ValueError("invalid OHLC")
    if not isinstance(candle["open_time"], int) or not isinstance(candle["close_time"], int) or candle["open_time"] >= candle["close_time"]:
        raise ValueError("invalid candle timestamps")
    return o, h, l, c


def _trigger(decision, high, low):
    if decision.action == "LONG":
        stop = low <= decision.stop_loss
        target = high >= decision.take_profit
    else:
        stop = high >= decision.stop_loss
        target = low <= decision.take_profit
    if stop and target:
        return "AMBIGUOUS"
    if stop:
        return "SL"
    if target:
        return "TP"
    return None


def process_closed_candle(account: PaperAccount, candle: dict, *,
                          lower_timeframe_candles=(), fee_rate=0.0,
                          slippage_rate=0.0, max_exit_time_ms=None):
    """Process one closed bar after entry; returns exit record or None.

    Caller must provide only closed exchange-native bars. For a dual-hit
    candle, finer bars must cover the full parent interval to disambiguate;
    otherwise the conservative stop-first fallback applies.
    """
    o, h, l, c = _validate_candle(candle)
    p = account.position
    if p is None:
        return None
    if candle["close_time"] <= p.entry_time_ms:
        return None
    if candle["open_time"] < p.entry_time_ms:
        raise ValueError("entry inside candle: cannot infer post-entry path")
    decision = p.decision
    hit = _trigger(decision, h, l)
    ambiguous = hit == "AMBIGUOUS"
    if ambiguous:
        finer = sorted(lower_timeframe_candles, key=lambda x: x["open_time"])
        covered = bool(finer) and finer[0]["open_time"] <= candle["open_time"] and finer[-1]["close_time"] >= candle["close_time"]
        previous_close = None
        for child in finer:
            _validate_candle(child)
            if child["open_time"] < candle["open_time"] or child["close_time"] > candle["close_time"]:
                covered = False
            if previous_close is not None and child["open_time"] > previous_close + 1:
                covered = False
            previous_close = child["close_time"]
        if covered:
            for child in finer:
                candidate = _trigger(decision, child["high"], child["low"])
                if candidate:
                    hit = "SL" if candidate == "AMBIGUOUS" else candidate
                    ambiguous = candidate == "AMBIGUOUS"
                    break
        if hit == "AMBIGUOUS":
            hit = "SL"
            ambiguous = True
    # MAE must only use prices observed before the exit trigger. A parent
    # candle's full high/low may include movement AFTER the position closed.
    # With finer candles, only include candles through the first trigger.
    if hit is not None and lower_timeframe_candles and 'covered' in locals() and covered:
        for child in finer:
            account.mark(child["low"], child["high"])
            if _trigger(decision, child["high"], child["low"]):
                break
    elif hit is None:
        account.mark(l, h)
    else:
        # Without a reliable intrabar path, use conservative parent extremes.
        account.mark(l, h)
    if hit is not None:
        price = decision.stop_loss if hit == "SL" else decision.take_profit
        result = account.exit(price, candle["close_time"], fee_rate=fee_rate,
                              slippage_rate=slippage_rate, reason=hit)
        result["ambiguous_fill"] = ambiguous
        return result
    if max_exit_time_ms is not None and candle["close_time"] >= max_exit_time_ms:
        result = account.exit(c, candle["close_time"], fee_rate=fee_rate,
                              slippage_rate=slippage_rate, reason="TIME_LIMIT")
        result["ambiguous_fill"] = False
        return result
    return None
