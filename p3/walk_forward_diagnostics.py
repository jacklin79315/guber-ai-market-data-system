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


def diagnose_eligible_trades(replay):
    """Descriptive trade evidence for research with drawdown <=35%.

    Never infer causal failure mechanisms from aggregate counts. No holdout
    access, model mutation, parameter selection, or promotion occurs here.
    """
    metrics = replay["metrics"]
    dd = metrics.get("max_close_to_close_drawdown_percent")
    if (type(dd) not in (int, float) or not 0 <= dd <= 35):
        return None
    exits = [e for e in replay["events"] if e.get("type") == "EXIT"]
    by_side = {}
    missing_side = 0
    for event in exits:
        side = event.get("side")
        if side not in ("LONG", "SHORT"):
            missing_side += 1
            continue
        row = by_side.setdefault(side, {"closed": 0, "wins": 0, "losses": 0,
                                        "stop_losses": 0, "net_pnl": 0.0})
        row["closed"] += 1
        pnl = event.get("net_pnl")
        if type(pnl) in (int, float):
            row["net_pnl"] += pnl
            row["wins"] += pnl > 0
            row["losses"] += pnl < 0
        if event.get("reason") == "SL":
            row["stop_losses"] += 1
    for row in by_side.values():
        row["win_rate_percent"] = (100 * row["wins"] / row["closed"]
                                   if row["closed"] else None)
    signal_counts = metrics.get("signal_counts") or {}
    return {
        "status": "DESCRIPTIVE_RESEARCH_EVIDENCE",
        "eligible_for_candidate_selection": False,
        "closed_trade_events": len(exits),
        "by_direction": by_side,
        "missing_direction_events": missing_side,
        "insufficient_cash_signals": signal_counts.get("INSUFFICIENT_CASH"),
        "not_filled_signals": signal_counts.get("NOT_FILLED"),
        "ambiguous_exit_count": metrics.get("ambiguous_exit_count"),
        "unresolved_entry_bar_count": metrics.get("entry_bars_with_unresolved_exit"),
        "limitations": ("Observed outcomes only; no proven causality or market-regime "
                        "attribution. Missing direction and small samples reduce confidence."),
    }
