"""Portfolio-level multi-lot replay metrics, isolated from legacy single-lot scoring."""
from math import tanh
from .performance import YEAR_MS, INITIAL_EQUITY


def summarize_multi_position(result, *, score_k=2.0):
    """Keep closed-trade results separate from marked open-position equity."""
    if score_k <= 0:
        raise ValueError("score_k must be positive")
    account = result["account"]
    curve = result["equity_curve"]
    trades = account.closed_trades
    events = result["events"]
    signals = result.get("signals", [])
    boundary_trades = [t for t in trades if t.get("reason") == "BACKTEST_END_SETTLEMENT"]
    profits = [t["net_pnl"] for t in trades]
    scores = [50 + 50 * tanh(t["reward_p"] / score_k) for t in trades]
    peak = INITIAL_EQUITY
    drawdown = 0.0
    for point in curve:
        peak = max(peak, point["equity"])
        drawdown = max(drawdown, 100 * (peak - point["equity"]) / peak)
    first = curve[0]["time_ms"] if curve else None
    last = curve[-1]["time_ms"] if curve else None
    elapsed = last - first if first is not None else 0
    final = curve[-1]["equity"] if curve else None
    counts = {name: sum(s["outcome"] == name for s in signals)
              for name in ("WAIT", "FILLED", "NOT_FILLED", "INSUFFICIENT_CASH")}
    return {
        "closed_trades": len(trades),
        "normal_closed_trades": len(trades) - len(boundary_trades),
        "backtest_end_settlement_count": len(boundary_trades),
        "backtest_end_settlement_percent": 100 * len(boundary_trades) / len(trades) if trades else 0.0,
        "open_lots": len(account.positions),
        "available_cash": account.cash,
        "realized_net_pnl": sum(profits),
        "win_rate_percent": 100 * sum(p > 0 for p in profits) / len(profits) if profits else None,
        "mean_score_q": sum(scores) / len(scores) if scores else None,
        "final_mark_to_market_equity": final,
        "mark_to_market_return_percent": 100 * (final / INITIAL_EQUITY - 1) if final is not None else None,
        "annualized_return_percent": (
            100 * (final / INITIAL_EQUITY - 1) / (elapsed / YEAR_MS)
            if final is not None and elapsed > 0 and not account.positions else None
        ),
        "annualized_mark_to_market_return_percent": (
            100 * (final / INITIAL_EQUITY - 1) / (elapsed / YEAR_MS)
            if final is not None and elapsed > 0 else None
        ),
        "max_close_to_close_drawdown_percent": drawdown if curve else None,
        "entry_bars_with_unresolved_exit": sum(
            e["type"] == "ENTRY" and e.get("entry_bar_exit_unresolved", False) for e in events
        ),
        "ambiguous_exit_count": sum(
            e["type"] == "EXIT" and e.get("ambiguous_fill", False) for e in events
        ),
        "signal_counts": counts,
        "signal_count": len(signals),
        "mean_cash_utilization_percent": (
            100 * sum(1 - p["cash"] / p["equity"] for p in curve if p["equity"] > 0)
            / sum(p["equity"] > 0 for p in curve)
            if curve and any(p["equity"] > 0 for p in curve) else None
        ),
        "evaluation_start_ms": first,
        "evaluation_end_ms": last,
        "evaluation_elapsed_days": elapsed / 86400000 if elapsed else None,
    }
