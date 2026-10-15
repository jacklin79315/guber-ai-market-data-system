"""Read-only portfolio accounting audit for independent positions."""
from math import isfinite


def audit_portfolio(account, prices=None):
    prices = {} if prices is None else prices
    cash = account.cash
    if not isfinite(cash) or cash < -1e-8:
        raise ValueError("invalid cash")
    reserved = 0.0
    unrealized = 0.0
    symbols = {}
    for lot in account.positions.values():
        mark = prices.get(lot.decision.symbol, lot.entry_price)
        notional = lot.quantity * lot.entry_price
        if not all(isfinite(x) and x > 0 for x in (mark, notional)):
            raise ValueError("invalid position valuation")
        pnl = lot.quantity * (mark - lot.entry_price) * (
            1 if lot.decision.action == "LONG" else -1)
        reserved += notional
        unrealized += pnl
        row = symbols.setdefault(lot.decision.symbol, {"lots": 0, "notional": 0.0})
        row["lots"] += 1
        row["notional"] += notional
    equity = cash + reserved + unrealized
    if not isfinite(equity):
        raise ValueError("invalid equity")
    if abs(equity - account.equity(prices)) > 1e-7 * max(1, abs(equity)):
        raise ValueError("equity mismatch")
    return {"cash": cash, "reserved": reserved, "unrealized": unrealized,
            "equity": equity, "open_lots": len(account.positions),
            "symbols": symbols}
