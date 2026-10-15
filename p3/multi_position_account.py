"""Multi-lot, shared-cash paper portfolio; no order placement or AI policy.

Each fill is a distinct lot. No implicit netting or averaging. Synthetic shorts
reserve full notional as collateral, matching the legacy PaperAccount convention.
"""
from dataclasses import dataclass, field
from math import isfinite
from .paper_engine import Decision, Position, INITIAL_EQUITY, reward, _positive


@dataclass
class MultiPositionAccount:
    cash: float = INITIAL_EQUITY
    positions: dict = field(default_factory=dict)
    closed_trades: list = field(default_factory=list)
    next_lot_id: int = 1

    def equity(self, prices=None):
        prices = prices or {}
        value = self.cash
        for lot in self.positions.values():
            price = prices.get(lot.decision.symbol, lot.entry_price)
            direction = 1 if lot.decision.action == "LONG" else -1
            value += lot.quantity * lot.entry_price
            value += lot.quantity * (price - lot.entry_price) * direction
        return value

    def enter(self, decision: Decision, time_ms: int, *,
              decision_close_time_ms=None, fee_rate=0.0, slippage_rate=0.0):
        decision.validate()
        if decision.action == "WAIT":
            return None
        if decision_close_time_ms is not None and time_ms <= decision_close_time_ms:
            raise ValueError("entry must be after decision candle close")
        if any(not isfinite(x) or x < 0 or x >= 1 for x in (fee_rate, slippage_rate)):
            raise ValueError("invalid trading cost")
        pre_equity = self.equity()
        notional = pre_equity * decision.allocation
        fill = decision.entry * (1 + slippage_rate if decision.action == "LONG"
                                 else 1 - slippage_rate)
        fee = notional * fee_rate
        if notional + fee > self.cash + 1e-9:
            return None  # No leverage or reused collateral.
        lot = Position(decision, notional / fill, fill, pre_equity, fee,
                       time_ms, decision_close_time_ms)
        lot_id = self.next_lot_id
        self.next_lot_id += 1
        self.cash -= notional + fee
        self.positions[lot_id] = lot
        return lot_id, lot

    def mark(self, lot_id, low, high):
        lot = self.positions[lot_id]
        low, high = _positive(low, "low"), _positive(high, "high")
        if low > high:
            raise ValueError("low > high")
        adverse = ((lot.entry_price - low) / lot.entry_price
                   if lot.decision.action == "LONG"
                   else (high - lot.entry_price) / lot.entry_price)
        lot.max_adverse_percent = max(lot.max_adverse_percent, 100 * adverse, 0)

    def exit(self, lot_id, price, time_ms, *, fee_rate=0.0,
             slippage_rate=0.0, reason="EXIT"):
        lot = self.positions[lot_id]
        price = _positive(price, "exit price")
        if time_ms < lot.entry_time_ms:
            raise ValueError("exit before entry")
        if any(not isfinite(x) or x < 0 or x >= 1 for x in (fee_rate, slippage_rate)):
            raise ValueError("invalid trading cost")
        fill = price * (1 - slippage_rate if lot.decision.action == "LONG"
                        else 1 + slippage_rate)
        exit_fee = lot.quantity * fill * fee_rate
        gross = lot.quantity * (fill - lot.entry_price) * (
            1 if lot.decision.action == "LONG" else -1)
        pnl = gross - lot.entry_fee - exit_fee
        self.cash += lot.quantity * lot.entry_price + gross - exit_fee
        del self.positions[lot_id]
        record = {
            "lot_id": lot_id, "symbol": lot.decision.symbol,
            "side": lot.decision.action, "entry_time_ms": lot.entry_time_ms,
            "exit_time_ms": time_ms, "entry_price": lot.entry_price,
            "exit_price": fill, "quantity": lot.quantity, "net_pnl": pnl,
            "pre_entry_equity": lot.pre_entry_equity,
            "planned_rr": abs(lot.decision.take_profit - lot.decision.entry)
                          / abs(lot.decision.entry - lot.decision.stop_loss),
            "mae_percent": lot.max_adverse_percent,
            "reward_p": reward(pnl, lot.pre_entry_equity, lot.max_adverse_percent),
            "reason": reason, "equity_after": self.equity(),
        }
        self.closed_trades.append(record)
        return record
