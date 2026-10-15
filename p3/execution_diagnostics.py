"""Read-only execution diagnostics for holdout paper-trading results.

All statistics use completed trades only; no model fitting or signal changes.
"""


def summarize_execution(account, events):
    trades = account.closed_trades
    def group(items):
        pnl = [float(t["net_pnl"]) for t in items]
        return {
            "trades": len(items),
            "net_pnl": sum(pnl),
            "win_rate_percent": 100 * sum(x > 0 for x in pnl) / len(pnl) if pnl else None,
            "mean_net_pnl": sum(pnl) / len(pnl) if pnl else None,
        }

    entries = [e for e in events if e.get("type") == "ENTRY"]
    exits = [e for e in events if e.get("type") == "EXIT"]
    return {
        "by_side": {side: group([t for t in trades if t["side"] == side])
                    for side in ("LONG", "SHORT")},
        "by_exit_reason": {reason: group([t for t in trades if t["reason"] == reason])
                           for reason in sorted({t["reason"] for t in trades})},
        "entry_count": len(entries),
        "exit_count": len(exits),
        "unresolved_entry_bar_count": sum(bool(e.get("entry_bar_exit_unresolved")) for e in entries),
        "ambiguous_exit_count": sum(bool(e.get("ambiguous_fill")) for e in exits),
        "open_position_at_end": account.position is not None,
        "mean_planned_rr": (sum(t["planned_rr"] for t in trades) / len(trades)
                            if trades else None),
        "mean_mae_percent": (sum(t["mae_percent"] for t in trades) / len(trades)
                             if trades else None),
    }
