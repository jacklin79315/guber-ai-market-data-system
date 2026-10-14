"""Transparent performance reporting for a single completed replay.

Unclosed positions are NOT counted as realized profit. Metrics explicitly
separate realized account cash from open exposure; mark-to-market valuation
requires a separately supplied latest price and is not invented here.
"""
from math import tanh, isfinite


def summarize(account, *, elapsed_ms=None, score_k=2.0):
    if not isinstance(score_k, (int, float)) or not isfinite(score_k) or score_k <= 0:
        raise ValueError("score_k must be finite and positive")
    trades = account.closed_trades
    n = len(trades)
    profits = [t["net_pnl"] for t in trades]
    scores = [50.0 + 50.0 * tanh(t["reward_p"] / score_k) for t in trades]
    wins = sum(p > 0 for p in profits)
    initial = 10000.0
    result = {
        "closed_trades": n,
        "realized_net_pnl": sum(profits),
        "mean_reward_p": sum(t["reward_p"] for t in trades) / n if n else None,
        "mean_score_q": sum(scores) / n if n else None,
        "win_rate_percent": 100.0 * wins / n if n else None,
        "realized_cash": account.cash,
        "has_open_position": account.position is not None,
        "annualized_return_percent": None,
    }
    if elapsed_ms is not None:
        if not isinstance(elapsed_ms, (int, float)) or not isfinite(elapsed_ms) or elapsed_ms <= 0:
            raise ValueError("elapsed_ms must be positive")
        if account.position is None:
            years = elapsed_ms / (365.25 * 24 * 60 * 60 * 1000)
            result["annualized_return_percent"] = 100 * (account.cash / initial - 1) / years
    return result
