"""Deterministic, policy-neutral historical replay for one strategy and symbol.

Decisions must be generated only from information available at each decision
close. This runner accepts decisions; it does not produce trading signals.
A filled entry bar is NOT processed for exits because OHLC cannot determine
whether TP/SL was hit before or after entry.
"""
from .paper_engine import PaperAccount
from .replay_entry import try_enter_next_candle
from .candle_execution import process_closed_candle, _validate_candle


def replay(candles, decisions_by_close, *, fee_rate=0.0,
           slippage_rate=0.0, max_holding_ms=None):
    """Replay ordered native candles, returning account and execution events.

    decisions_by_close maps the *closed* decision candle's close_time to a
    Decision. Orders are valid only for the immediately following candle.
    At most one open position per account. No same-bar re-entry.
    """
    if max_holding_ms is not None and (not isinstance(max_holding_ms, int) or max_holding_ms <= 0):
        raise ValueError("max_holding_ms must be positive")
    account = PaperAccount()
    events = []
    previous = None
    for candle in candles:
        _validate_candle(candle)
        if previous is not None and candle["open_time"] <= previous["close_time"]:
            raise ValueError("candles overlap or are unordered")
        if account.position is not None:
            position = account.position
            limit = (position.entry_time_ms + max_holding_ms
                     if max_holding_ms is not None else None)
            result = process_closed_candle(
                account, candle, fee_rate=fee_rate,
                slippage_rate=slippage_rate, max_exit_time_ms=limit)
            if result is not None:
                events.append({"type": "EXIT", **result})
        elif previous is not None:
            decision = decisions_by_close.get(previous["close_time"])
            if decision is not None:
                position = try_enter_next_candle(
                    account, decision, previous["close_time"], candle,
                    fee_rate=fee_rate, slippage_rate=slippage_rate)
                if position is not None:
                    events.append({"type": "ENTRY", "symbol": decision.symbol,
                                   "side": decision.action,
                                   "time_ms": position.entry_time_ms,
                                   "price": position.entry_price})
        previous = candle
    return account, events
