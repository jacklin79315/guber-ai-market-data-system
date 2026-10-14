"""Per-account completed-trade performance; no fabricated unrealized returns."""
from math import tanh, isfinite

INITIAL_EQUITY = 10000.0
YEAR_MS = 365.25 * 24 * 60 * 60 * 1000


def summarize(account, *, elapsed_ms=None, score_k=2.0):
    if isinstance(score_k, bool) or not isinstance(score_k, (int, float)) or not isfinite(score_k) or score_k <= 0:
        raise ValueError("score_k must be finite and positive")
    if elapsed_ms is not None and (
        isinstance(elapsed_ms, bool) or not isinstance(elapsed_ms, (int, float))
        or not isfinite(elapsed_ms) or elapsed_ms <= 0
    ):
        raise ValueError("elapsed_ms must be positive")

    trades = account.closed_trades
    n = len(trades)
    profits = [t["net_pnl"] for t in trades]
    scores = [50.0 + 50.0 * tanh(t["reward_p"] / score_k) for t in trades]
    peak = INITIAL_EQUITY
    max_drawdown = 0.0
    for trade in trades:
        equity = trade["equity_after"]
        if equity > peak:
            peak = equity
        else:
            max_drawdown = max(max_drawdown, 100.0 * (peak - equity) / peak)

    # Risk/reward is based on the original model plan, not realized PnL.
    rr_values = [t["planned_rr"] for t in trades if t.get("planned_rr") is not None]
    result = {
        "closed_trades": n,
        "realized_net_pnl": sum(profits),
        "mean_reward_p": sum(t["reward_p"] for t in trades) / n if n else None,
        "mean_score_q": sum(scores) / n if n else None,
        "win_rate_percent": 100.0 * sum(p > 0 for p in profits) / n if n else None,
        "mean_trade_return_percent": (
            sum(100.0 * t["net_pnl"] / t["pre_entry_equity"] for t in trades) / n
            if n else None
        ),
        "mean_planned_rr": sum(rr_values) / len(rr_values) if rr_values else None,
        "max_realized_drawdown_percent": max_drawdown,
        "available_cash": account.cash,
        "has_open_position": account.position is not None,
        "annualized_return_percent": None,
    }
    if elapsed_ms is not None and account.position is None:
        result["annualized_return_percent"] = (
            100.0 * (account.cash / INITIAL_EQUITY - 1.0) / (elapsed_ms / YEAR_MS)
        )
    return result
