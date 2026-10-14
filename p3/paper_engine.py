"""P3B deterministic paper-trading accounting, independent of model policy.

The model chooses LONG/SHORT/WAIT, entry, stop, target, and allocation.
This module never generates trade signals or trains a model.
Prices are quote-USDT, quantities are base units, fees are quote-USDT.
"""
from dataclasses import dataclass, field
from math import isfinite

INITIAL_EQUITY = 10_000.0
MAX_ALLOCATION = 0.80
LOSS_MULTIPLIER = 1.25
MAE_BUCKETS = ((5, 1.0, 1.0), (10, .95, 1.05),
               (15, .85, 1.20), (20, .70, 1.50),
               (float("inf"), .50, 2.00))


def _positive(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or value <= 0:
        raise ValueError(f"{name} must be finite and positive")
    return float(value)


@dataclass(frozen=True)
class Decision:
    action: str
    symbol: str
    entry: float | None = None
    take_profit: float | None = None
    stop_loss: float | None = None
    allocation: float = 0.0

    def validate(self):
        if self.action not in ("LONG", "SHORT", "WAIT"):
            raise ValueError("invalid action")
        if not self.symbol:
            raise ValueError("missing symbol")
        if self.action == "WAIT":
            if self.allocation != 0:
                raise ValueError("WAIT must not allocate")
            return
        entry = _positive(self.entry, "entry")
        target = _positive(self.take_profit, "take_profit")
        stop = _positive(self.stop_loss, "stop_loss")
        if not isinstance(self.allocation, (int, float)) or isinstance(self.allocation, bool) or not isfinite(self.allocation) or not (0 < self.allocation <= MAX_ALLOCATION):
            raise ValueError("allocation must be within (0, 0.8]")
        if self.action == "LONG" and not (stop < entry < target):
            raise ValueError("LONG requires stop < entry < target")
        if self.action == "SHORT" and not (target < entry < stop):
            raise ValueError("SHORT requires target < entry < stop")


def reward(net_pnl, pre_entry_equity, mae_percent):
    """Raw signed and uncapped reward P, not normalized display score Q."""
    equity = _positive(pre_entry_equity, "pre_entry_equity")
    if not isfinite(net_pnl) or not isfinite(mae_percent) or mae_percent < 0:
        raise ValueError("invalid pnl or MAE")
    w_profit, w_loss = next((p, l) for threshold, p, l in MAE_BUCKETS
                            if mae_percent <= threshold)
    r = 100.0 * net_pnl / equity
    return r * (w_profit if r > 0 else LOSS_MULTIPLIER * w_loss if r < 0 else 0.0)


@dataclass
class Position:
    decision: Decision
    quantity: float
    entry_price: float
    pre_entry_equity: float
    entry_fee: float
    entry_time_ms: int
    decision_close_time_ms: int | None = None
    max_adverse_percent: float = 0.0


@dataclass
class PaperAccount:
    """One account per strategy. Synthetic shorts, no leverage or borrowing."""
    cash: float = INITIAL_EQUITY
    position: Position | None = None
    closed_trades: list = field(default_factory=list)

    def enter(self, decision: Decision, time_ms: int, *, decision_close_time_ms=None, fee_rate: float = 0.0, slippage_rate: float = 0.0):
        decision.validate()
        if decision_close_time_ms is not None and time_ms <= decision_close_time_ms:
            raise ValueError("entry must be after decision candle close")
        if decision.action == "WAIT":
            return None
        if self.position is not None:
            raise ValueError("position already open")
        if any(not isfinite(v) or v < 0 or v >= 1 for v in (fee_rate, slippage_rate)):
            raise ValueError("invalid trading cost")
        equity = self.cash
        notional = equity * decision.allocation
        fill = decision.entry * (1 + slippage_rate if decision.action == "LONG" else 1 - slippage_rate)
        qty = notional / fill
        fee = notional * fee_rate
        if notional + fee > equity:
            raise ValueError("insufficient cash")
        self.cash -= notional + fee
        self.position = Position(decision, qty, fill, equity, fee, time_ms, decision_close_time_ms)
        return self.position

    def mark(self, low: float, high: float):
        p = self.position
        if p is None:
            return
        low = _positive(low, "low")
        high = _positive(high, "high")
        if low > high:
            raise ValueError("low > high")
        adverse = (p.entry_price - low) / p.entry_price if p.decision.action == "LONG" else (high - p.entry_price) / p.entry_price
        p.max_adverse_percent = max(p.max_adverse_percent, 100 * adverse, 0.0)

    def exit(self, price: float, time_ms: int, *, fee_rate: float = 0.0, slippage_rate: float = 0.0, reason: str = "EXIT"):
        p = self.position
        if p is None:
            raise ValueError("no position")
        price = _positive(price, "exit price")
        if any(not isfinite(v) or v < 0 or v >= 1 for v in (fee_rate, slippage_rate)):
            raise ValueError("invalid trading cost")
        if time_ms < p.entry_time_ms:
            raise ValueError("exit before entry")
        fill = price * (1 - slippage_rate if p.decision.action == "LONG" else 1 + slippage_rate)
        exit_fee = p.quantity * fill * fee_rate
        gross_pnl = p.quantity * (fill - p.entry_price) * (1 if p.decision.action == "LONG" else -1)
        net_pnl = gross_pnl - p.entry_fee - exit_fee
        # Synthetic short collateral is reserved just like a long; no margin/leverage.
        self.cash += p.quantity * p.entry_price + gross_pnl - exit_fee
        record = {"symbol": p.decision.symbol, "side": p.decision.action,
                  "entry_time_ms": p.entry_time_ms, "exit_time_ms": time_ms,
                  "entry_price": p.entry_price, "exit_price": fill,
                  "quantity": p.quantity, "net_pnl": net_pnl,
                  "mae_percent": p.max_adverse_percent,
                  "reward_p": reward(net_pnl, p.pre_entry_equity, p.max_adverse_percent),
                  "reason": reason, "equity_after": self.cash}
        self.closed_trades.append(record)
        self.position = None
        return record
