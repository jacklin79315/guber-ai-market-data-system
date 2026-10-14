"""Historical entry matching on exchange-native candles, never the decision bar.

A limit entry is considered filled when the following eligible candle trades
through the requested price. No price improvement or gap assumption is made.
This module is an execution model, not a signal generator.
"""
from .paper_engine import Decision, PaperAccount
from .candle_execution import _validate_candle


def try_enter_next_candle(account: PaperAccount, decision: Decision,
                          decision_close_time_ms: int, candle: dict, *,
                          fee_rate: float = 0.0, slippage_rate: float = 0.0):
    """Attempt fill on the immediately following native candle only.

    Caller supplies a candle whose open_time equals decision_close_time+1.
    Missing next candle is not silently skipped. Returns Position or None.
    """
    decision.validate()
    if decision.action == "WAIT":
        return None
    _validate_candle(candle)
    if candle["open_time"] != decision_close_time_ms + 1:
        raise ValueError("not the immediately following candle")
    if not candle["low"] <= decision.entry <= candle["high"]:
        return None
    return account.enter(decision, candle["open_time"],
                         decision_close_time_ms=decision_close_time_ms,
                         fee_rate=fee_rate, slippage_rate=slippage_rate)
