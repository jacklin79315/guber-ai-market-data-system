"""Evidence-only diagnostics for research drawdowns above 35% and up to 40%."""


def diagnose_drawdown(replay):
    metrics = replay["metrics"]
    dd = metrics.get("max_close_to_close_drawdown_percent")
    if dd is None or not 35 < dd <= 40:
        return None
    exits = [e for e in replay["events"] if e.get("type") == "EXIT"]
    losses = [e for e in exits if isinstance(e.get("net_pnl"), (int, float)) and e["net_pnl"] < 0]
    stops = [e for e in exits if e.get("reason") == "SL"]
    curve = replay["equity_curve"]
    peak = None
    peak_time = None
    worst = None
    for point in curve:
        value = point["equity"]
        if peak is None or value > peak:
            peak, peak_time = value, point["time_ms"]
        if peak > 0:
            drop = 100 * (peak - value) / peak
            if worst is None or drop > worst["drawdown_percent"]:
                worst = {"drawdown_percent": drop, "peak_time_ms": peak_time,
                         "trough_time_ms": point["time_ms"],
                         "open_lots_at_trough": point["open_lots"]}
    return {
        "status": "FAILURE_DIAGNOSIS_ONLY",
        "eligible_for_candidate_selection": False,
        "max_drawdown_episode": worst,
        "normal_exit_events": len(exits),
        "loss_exit_events": len(losses),
        "stop_loss_exit_events": len(stops),
        "insufficient_cash_signals": metrics.get("signal_counts", {}).get("INSUFFICIENT_CASH"),
        "ambiguous_exit_count": metrics.get("ambiguous_exit_count"),
        "unresolved_entry_bar_count": metrics.get("entry_bars_with_unresolved_exit"),
        "limitations": ("These are observed event counts, not proven causes. "
                        "Direction mistakes, entry quality, slippage attribution, "
                        "and correlated exposure require additional trade-level evidence."),
    }
