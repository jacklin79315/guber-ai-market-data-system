"""Opt-in multi-lot replay. Legacy single-position training is unchanged.

One chronological native-candle stream per symbol. Multiple symbols may be
merged by close time; only decisions known at the preceding close can fill.
No same-entry-bar exits because intrabar sequence is unknowable.
"""
from .candle_execution import _trigger, _validate_candle
from .multi_position_account import MultiPositionAccount


def replay_multi_positions(candles_by_symbol, decisions_by_symbol, *,
                           fee_rate=0.0, slippage_rate=0.0,
                           score_k=2.0, settle_at_end=False):
    account = MultiPositionAccount()
    events = []
    equity_curve = []
    candles = []
    for symbol, bars in candles_by_symbol.items():
        previous = None
        for bar in bars:
            _validate_candle(bar)
            if previous is not None and bar["open_time"] <= previous["close_time"]:
                raise ValueError("overlapping or unordered candles")
            candles.append((bar["close_time"], symbol, bar, previous))
            previous = bar
    candles.sort(key=lambda x: (x[0], x[1]))
    prices = {}
    signal_events = []
    previous_close_time = None
    for close_time, symbol, bar, previous in candles:
        if previous_close_time is not None and close_time < previous_close_time:
            raise ValueError("merged candle timeline must be chronological")
        previous_close_time = close_time
        # First exit previously open lots on this symbol; entry-bar exits are
        # intentionally deferred, consistent with the legacy OHLC assumption.
        for lot_id, lot in list(account.positions.items()):
            if lot.decision.symbol != symbol or bar["close_time"] <= lot.entry_time_ms:
                continue
            if bar["open_time"] < lot.entry_time_ms:
                raise ValueError("entry inside candle")
            hit, ambiguous = _trigger(lot.decision, bar["high"], bar["low"], bar["close"])
            if hit == "SL":
                if lot.decision.action == "LONG":
                    account.mark(lot_id, min(bar["high"], max(bar["low"], lot.decision.stop_loss)), bar["high"])
                else:
                    account.mark(lot_id, bar["low"], max(bar["low"], min(bar["high"], lot.decision.stop_loss)))
            elif hit is None:
                account.mark(lot_id, bar["low"], bar["high"])
            if hit:
                level = lot.decision.stop_loss if hit == "SL" else lot.decision.take_profit
                result = account.exit(lot_id, level, close_time,
                                      fee_rate=fee_rate, slippage_rate=slippage_rate,
                                      reason=hit)
                events.append({"type": "EXIT", "ambiguous_fill": ambiguous, **result})
        if previous is not None:
            decision = decisions_by_symbol.get(symbol, {}).get(previous["close_time"])
            if decision is not None:
                decision.validate()
                if decision.symbol != symbol:
                    raise ValueError("decision symbol mismatch")
                signal = {"symbol": symbol, "decision_time_ms": previous["close_time"],
                          "action": decision.action, "entry": decision.entry,
                          "take_profit": decision.take_profit, "stop_loss": decision.stop_loss,
                          "allocation": decision.allocation, "outcome": "WAIT" if decision.action == "WAIT" else "NOT_FILLED"}
                signal_events.append(signal)
            if decision is not None and decision.action != "WAIT":
                if decision.symbol != symbol:
                    raise ValueError("decision symbol mismatch")
                if bar["open_time"] != previous["close_time"] + 1:
                    raise ValueError("missing immediately following candle")
                if bar["low"] <= decision.entry <= bar["high"]:
                    filled = account.enter(decision, bar["open_time"],
                                           decision_close_time_ms=previous["close_time"],
                                           fee_rate=fee_rate, slippage_rate=slippage_rate)
                    if filled is None:
                        signal["outcome"] = "INSUFFICIENT_CASH"
                        events.append({"type": "REJECTED", "reason": "INSUFFICIENT_CASH",
                                       "symbol": symbol, "time_ms": bar["open_time"]})
                    else:
                        signal["outcome"] = "FILLED"
                        lot_id, lot = filled
                        events.append({"type": "ENTRY", "lot_id": lot_id, "symbol": symbol,
                                       "side": decision.action, "time_ms": lot.entry_time_ms,
                                       "decision_time_ms": previous["close_time"],
                                       "price": lot.entry_price, "entry_time_estimated": True,
                                       "entry_bar_exit_unresolved": (
                                           bar["low"] <= decision.stop_loss <= bar["high"]
                                           or bar["low"] <= decision.take_profit <= bar["high"])})
        prices[symbol] = bar["close"]
        equity_curve.append({"time_ms": close_time, "equity": account.equity(prices),
                             "cash": account.cash, "open_lots": len(account.positions)})
    if settle_at_end and account.positions:
        end_time = equity_curve[-1]["time_ms"]
        for lot_id in list(account.positions):
            record = account.settle_backtest_end(lot_id, end_time, fee_rate=fee_rate)
            events.append({"type": "BACKTEST_END_SETTLEMENT", **record})
        # Boundary settlement is accounting only, not a market-price mark.
        equity_curve.append({"time_ms": end_time, "equity": account.equity(),
                             "cash": account.cash, "open_lots": 0})
    result = {"account": account, "events": events, "signals": signal_events,
              "equity_curve": equity_curve,
              "open_lots": len(account.positions), "closed_trades": len(account.closed_trades),
              "settled_equity": account.settled_equity,
              "capacity_limit": account.capacity_limit,
              "reserved_notional": account.reserved_notional,
              "remaining_capacity": account.remaining_capacity}
    from .multi_position_metrics import summarize_multi_position
    result["metrics"] = summarize_multi_position(result, score_k=score_k)
    return result
