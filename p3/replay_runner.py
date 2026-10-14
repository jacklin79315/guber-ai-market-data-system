"""Deterministic, policy-neutral historical replay for one strategy and symbol.

Decisions must be generated only from information available at each decision
close. This runner accepts decisions; it does not produce trading signals.
A filled entry bar is NOT processed for exits because OHLC cannot determine
whether TP/SL was hit before or after entry.
"""
from .paper_engine import PaperAccount
from .performance import summarize
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
    equity_curve = []
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
        # Mark-to-market at the completed bar close, using only that bar's
        # close. Reserved collateral is restored when valuing an open position.
        p = account.position
        equity = account.cash
        exposure = 0.0
        if p is not None:
            collateral = p.quantity * p.entry_price
            direction = 1 if p.decision.action == "LONG" else -1
            unrealized = p.quantity * (candle["close"] - p.entry_price) * direction
            equity += collateral + unrealized
            exposure = collateral
        equity_curve.append({"time_ms": candle["close_time"],
                             "equity": equity, "exposure": exposure})
        previous = candle
    return account, events


def replay_with_metrics(candles, decisions_by_close, *, fee_rate=0.0,
                        slippage_rate=0.0, max_holding_ms=None, score_k=2.0):
    """Replay and report completed trades; open position remains explicitly open."""
    bars = list(candles)
    account, events = replay(bars, decisions_by_close, fee_rate=fee_rate,
                             slippage_rate=slippage_rate,
                             max_holding_ms=max_holding_ms)
    elapsed = bars[-1]["close_time"] - bars[0]["open_time"] + 1 if bars else None
    metrics = summarize(account, elapsed_ms=elapsed, score_k=score_k)
    # Equity curve is reconstructed from the event stream at bar-close only.
    # Intrabar peak drawdown and utilization require a finer execution clock.
    return {"account": account, "events": events, "metrics": metrics}

