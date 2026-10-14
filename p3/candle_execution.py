"""P3B closed native-candle exit simulation.

When a candle hits both TP and SL, the closer level to the candle close wins.
An exact tie resolves to SL. This is a historical simulation assumption,
not a claim about actual intrabar execution order.
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


def _trigger(decision, high, low, close):
    if decision.action == "LONG":
        stop = low <= decision.stop_loss
        target = high >= decision.take_profit
    else:
        stop = high >= decision.stop_loss
        target = low <= decision.take_profit
    if stop and target:
        tp_distance = abs(close - decision.take_profit)
        sl_distance = abs(close - decision.stop_loss)
        return ("TP" if tp_distance < sl_distance else "SL"), True
    if stop:
        return "SL", False
    if target:
        return "TP", False
    return None, False


def process_closed_candle(account: PaperAccount, candle: dict, *,
                          fee_rate=0.0, slippage_rate=0.0,
                          max_exit_time_ms=None):
    """Process one fully closed native candle following entry.

    The caller must not enter on the decision candle. The replay runner
    must enforce that entry happens no earlier than the following candle.
    """
    o, h, l, c = _validate_candle(candle)
    p = account.position
    if p is None:
        return None
    if candle["close_time"] <= p.entry_time_ms:
        return None
    if candle["open_time"] < p.entry_time_ms:
        raise ValueError("entry inside candle: cannot infer post-entry path")
    hit, ambiguous = _trigger(p.decision, h, l, c)
    # OHLC cannot establish the intrabar pre-exit MAE. For now this is a
    # conservative whole-bar bound, recorded explicitly in the trade.
    # Simulated orders fill at the TP/SL level, never the candle extreme.
    # MAE on a stop exit is capped at the stop; intrabar order is unknown.
    if hit == "SL":
        if p.decision.action == "LONG":
            account.mark(max(l, p.decision.stop_loss), h)
        else:
            account.mark(l, min(h, p.decision.stop_loss))
    elif hit == "TP":
        # The bar extreme can occur after the TP fill. Do not charge
        # unknown post-exit adverse movement to this completed trade.
        # Prior fully held candles have already contributed to MAE.
        pass
    else:
        account.mark(l, h)
    if hit is not None:
        price = p.decision.stop_loss if hit == "SL" else p.decision.take_profit
        result = account.exit(price, candle["close_time"], fee_rate=fee_rate,
                              slippage_rate=slippage_rate, reason=hit)
        result["ambiguous_fill"] = ambiguous
        result["mae_estimated_from_full_bar"] = True
        result["mae_clipped_to_stop"] = hit == "SL"
        result["exit_bar_mae_omitted"] = hit == "TP"
        return result
    if max_exit_time_ms is not None and candle["close_time"] >= max_exit_time_ms:
        result = account.exit(c, candle["close_time"], fee_rate=fee_rate,
                              slippage_rate=slippage_rate, reason="TIME_LIMIT")
        result["ambiguous_fill"] = False
        result["mae_estimated_from_full_bar"] = False
        return result
    return None
