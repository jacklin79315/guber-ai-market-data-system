"""Deterministic, policy-neutral historical replay for one strategy and symbol.

Decisions must be generated only from information available at each decision
close. This runner accepts decisions; it does not produce trading signals.
A filled entry bar is NOT processed for exits because OHLC cannot determine
whether TP/SL was hit before or after entry. This unresolved bar is flagged.
"""
from .paper_engine import PaperAccount
from .performance import summarize
from .replay_entry import try_enter_next_candle
from .candle_execution import process_closed_candle, _validate_candle


def replay(candles, decisions_by_close, *, fee_rate=0.0,
           slippage_rate=0.0, max_holding_ms=None, return_curve=False):
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
                                   "price": position.entry_price,
                                   "entry_time_estimated": True,
                                   "entry_bar_exit_unresolved": (
                                       candle["low"] <= decision.stop_loss <= candle["high"]
                                       or candle["low"] <= decision.take_profit <= candle["high"]
                                   )})
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
    return (account, events, equity_curve) if return_curve else (account, events)


def replay_with_metrics(candles, decisions_by_close, *, fee_rate=0.0,
                        slippage_rate=0.0, max_holding_ms=None, score_k=2.0):
    """Replay and report completed trades; open position remains explicitly open."""
    bars = list(candles)
    account, events, curve = replay(bars, decisions_by_close, fee_rate=fee_rate,
                             slippage_rate=slippage_rate,
                             max_holding_ms=max_holding_ms, return_curve=True)
    elapsed = bars[-1]["close_time"] - bars[0]["open_time"] + 1 if bars else None
    metrics = summarize(account, elapsed_ms=elapsed, score_k=score_k)
    metrics["entry_bars_with_unresolved_exit"] = sum(
        1 for e in events if e["type"] == "ENTRY" and e["entry_bar_exit_unresolved"]
    )
    metrics["execution_path_uncertain"] = metrics["entry_bars_with_unresolved_exit"] > 0
    if curve:
        peak = 10000.0
        drawdown = 0.0
        for point in curve:
            peak = max(peak, point["equity"])
            if peak > 0:
                drawdown = max(drawdown, 100 * (peak - point["equity"]) / peak)
        metrics["final_mark_to_market_equity"] = curve[-1]["equity"]
        if elapsed is not None:
            metrics["annualized_mark_to_market_return_percent"] = (
                100 * (curve[-1]["equity"] / 10000.0 - 1) /
                (elapsed / (365.25 * 24 * 60 * 60 * 1000))
            )
        metrics["max_close_to_close_drawdown_percent"] = drawdown
        metrics["mean_capital_utilization_percent"] = (
            100 * sum(p["exposure"] / p["equity"] if p["equity"] > 0 else 0.0
                      for p in curve) / len(curve)
        )
    else:
        metrics["final_mark_to_market_equity"] = None
        metrics["annualized_mark_to_market_return_percent"] = None
        metrics["max_close_to_close_drawdown_percent"] = None
        metrics["mean_capital_utilization_percent"] = None
    return {"account": account, "events": events, "equity_curve": curve,
            "metrics": metrics}

