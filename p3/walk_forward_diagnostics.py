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


def audit_severe_drawdown(replay):
    """Audit >40% drawdown without creating candidate feedback."""
    metrics = replay["metrics"]
    dd = metrics.get("max_close_to_close_drawdown_percent")
    if type(dd) not in (int, float) or not dd > 40:
        return None
    exits = [e for e in replay.get("events", []) if e.get("type") == "EXIT"]
    groups = {}
    reason_groups = {}
    gross_wins = gross_losses = 0.0
    for e in exits:
        group = groups.setdefault(e.get("side") or "UNKNOWN",
            {"closed": 0, "losses": 0, "stop_losses": 0, "net_pnl": 0.0})
        group["closed"] += 1
        reason = e.get("reason") or "UNKNOWN"
        reason_group = reason_groups.setdefault(reason, {"closed": 0, "net_pnl": 0.0})
        reason_group["closed"] += 1
        pnl = e.get("net_pnl")
        if type(pnl) in (int, float):
            group["losses"] += pnl < 0
            group["net_pnl"] += pnl
            reason_group["net_pnl"] += pnl
            gross_wins += max(0, pnl)
            gross_losses += min(0, pnl)
        group["stop_losses"] += reason == "SL"
    curve = replay.get("equity_curve") or []
    peak = peak_time = worst = None
    for point in curve:
        equity = point.get("equity")
        if type(equity) not in (int, float):
            continue
        if peak is None or equity > peak:
            peak, peak_time = equity, point.get("time_ms")
        if peak and peak > 0:
            drop = 100 * (peak - equity) / peak
            if worst is None or drop > worst["drawdown_percent"]:
                worst = {"drawdown_percent": drop, "peak_time_ms": peak_time,
                         "trough_time_ms": point.get("time_ms"),
                         "open_lots_at_trough": point.get("open_lots")}
    return {"status": "SEVERE_DRAWDOWN_AUDIT_ONLY",
            "max_drawdown_percent": dd, "closed_trade_events": len(exits),
            "by_direction": groups, "by_exit_reason": reason_groups,
            "gross_winning_pnl": gross_wins, "gross_losing_pnl": gross_losses,
            "worst_drawdown_episode": worst,
            "signal_counts": dict(metrics.get("signal_counts") or {}),
            "ambiguous_exit_count": metrics.get("ambiguous_exit_count"),
            "unresolved_entry_bar_count": metrics.get("entry_bars_with_unresolved_exit"),
            "eligible_for_candidate_selection": False,
            "eligible_for_promotion": False,
            "limitations": "Descriptive audit only; no candidate generation or causal attribution."}


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
    # Pair only actual fills to their originating decision-close timestamp.
    # This is descriptive context, never an inferred cause of PnL.
    entries = {e.get("lot_id"): e for e in replay["events"]
               if e.get("type") == "ENTRY" and e.get("lot_id") is not None}
    signal_index = {(s.get("symbol"), s.get("decision_time_ms")): s
                    for s in replay.get("signals", [])
                    if s.get("outcome") == "FILLED"}
    context = {"matched_trades": 0, "unmatched_trades": 0,
               "planned_rr_sum": 0.0, "planned_rr_count": 0,
               "entry_bar_exit_unresolved": 0}
    for event in exits:
        entry = entries.get(event.get("lot_id"))
        signal = (signal_index.get((entry.get("symbol"), entry.get("decision_time_ms")))
                  if entry else None)
        if signal is None:
            context["unmatched_trades"] += 1
            continue
        context["matched_trades"] += 1
        context["entry_bar_exit_unresolved"] += bool(entry.get("entry_bar_exit_unresolved"))
        planned_rr = event.get("planned_rr")
        if type(planned_rr) in (int, float):
            context["planned_rr_sum"] += planned_rr
            context["planned_rr_count"] += 1
    context["mean_planned_rr"] = (context["planned_rr_sum"] / context["planned_rr_count"]
                                  if context["planned_rr_count"] else None)
    # Compare observed outcomes by actual entry-side and entry-bar ambiguity.
    # No new trading thresholds or inferred market regime.
    entry_condition_groups = {}
    for event in exits:
        entry = entries.get(event.get("lot_id"))
        signal = (signal_index.get((entry.get("symbol"), entry.get("decision_time_ms")))
                  if entry else None)
        if not entry or not signal:
            continue
        side = event.get("side")
        if side not in ("LONG", "SHORT"):
            continue
        unresolved = bool(entry.get("entry_bar_exit_unresolved"))
        key = f"{side}:{'ENTRY_BAR_UNRESOLVED' if unresolved else 'ENTRY_BAR_CLEAR'}"
        group = entry_condition_groups.setdefault(
            key, {"trades": 0, "wins": 0, "losses": 0, "stops": 0,
                  "net_pnl": 0.0, "missing_pnl": 0})
        group["trades"] += 1
        pnl = event.get("net_pnl")
        if type(pnl) in (int, float):
            group["wins"] += pnl > 0
            group["losses"] += pnl < 0
            group["net_pnl"] += pnl
        else:
            group["missing_pnl"] += 1
        group["stops"] += event.get("reason") == "SL"
    for group in entry_condition_groups.values():
        n = group["trades"] - group["missing_pnl"]
        group["win_rate_percent"] = 100 * group["wins"] / n if n else None
        group["sample_size_warning"] = n < 5
    signal_counts = metrics.get("signal_counts") or {}
    return {
        "status": "DESCRIPTIVE_RESEARCH_EVIDENCE",
        "eligible_for_candidate_selection": False,
        "closed_trade_events": len(exits),
        "by_direction": by_side,
        "entry_context": context,
        "entry_condition_groups": entry_condition_groups,
        "missing_direction_events": missing_side,
        "insufficient_cash_signals": signal_counts.get("INSUFFICIENT_CASH"),
        "not_filled_signals": signal_counts.get("NOT_FILLED"),
        "ambiguous_exit_count": metrics.get("ambiguous_exit_count"),
        "unresolved_entry_bar_count": metrics.get("entry_bars_with_unresolved_exit"),
        "limitations": ("Observed outcomes only; no proven causality or market-regime "
                        "attribution. Missing direction and small samples reduce confidence."),
    }


def audit_prediction_coverage(replay, direction_predictions, structure_predictions):
    """Count matched historical decisions without inferring loss causes."""
    entries = [e for e in replay["events"] if e.get("type") == "ENTRY"]
    direction_times = {p["decision_time_ms"] for p in direction_predictions}
    structure_times = {p["decision_time_ms"] for p in structure_predictions}
    total = len(entries)
    matched_direction = sum(e.get("decision_time_ms") in direction_times for e in entries)
    matched_structure = sum(e.get("decision_time_ms") in structure_times for e in entries)
    both = sum(e.get("decision_time_ms") in direction_times
               and e.get("decision_time_ms") in structure_times for e in entries)
    return {"entry_events": total, "matched_direction": matched_direction,
            "matched_structure": matched_structure, "matched_both": both,
            "missing_direction": total - matched_direction,
            "missing_structure": total - matched_structure,
            "status": "COVERAGE_AUDIT_ONLY",
            "eligible_for_candidate_selection": False}


def trade_prediction_rows(replay, direction_predictions, structure_predictions):
    """Match ordinary exits to decision-time predictions; descriptive only."""
    entries = {e["lot_id"]: e for e in replay["events"]
               if e.get("type") == "ENTRY" and e.get("lot_id") is not None}
    directions = {p["decision_time_ms"]: p for p in direction_predictions}
    structures = {p["decision_time_ms"]: p for p in structure_predictions}
    rows = []
    for exit_event in replay["events"]:
        if exit_event.get("type") != "EXIT":
            continue
        entry = entries.get(exit_event.get("lot_id"))
        if entry is None:
            continue
        t = entry.get("decision_time_ms")
        direction = directions.get(t, {})
        structure = structures.get(t, {})
        rows.append({
            "lot_id": exit_event["lot_id"],
            "decision_time_ms": t,
            "side": entry.get("side"),
            "entry_price": exit_event.get("entry_price"),
            "exit_price": exit_event.get("exit_price"),
            "net_pnl": exit_event.get("net_pnl"),
            "exit_reason": exit_event.get("reason"),
            "probability_up": direction.get("probability_up"),
            "predicted_upper_bound": structure.get("predicted_upper_bound"),
            "predicted_lower_bound": structure.get("predicted_lower_bound"),
            "forecast_pair_complete": bool(direction) and bool(structure),
        })
    return rows


def classify_research_evidence(coverage, direction, structure, trades):
    """Conservative evidence routing, not a causal diagnosis or promotion."""
    total = coverage.get("entry_events", 0)
    paired = coverage.get("matched_both", 0)
    if not total or paired != total:
        return {"status": "WAIT", "reason": "INCOMPLETE_TRADE_FORECAST_LINKAGE",
                "eligible_for_candidate_selection": False}
    if not trades or any(not r.get("forecast_pair_complete") for r in trades):
        return {"status": "WAIT", "reason": "INCOMPLETE_CLOSED_TRADE_RECORDS",
                "eligible_for_candidate_selection": False}
    d_ok = (direction.get("status") == "RESEARCH_DIRECTION_EVALUATION"
            and direction.get("matched_predictions", 0) >= 5)
    s_ok = (structure.get("status") == "RESEARCH_FORECAST_EVALUATION"
            and structure.get("matched_predictions", 0) >= 5)
    if not d_ok or not s_ok:
        return {"status": "WAIT", "reason": "INSUFFICIENT_MATURED_MODEL_LABELS",
                "eligible_for_candidate_selection": False}
    return {"status": "EVIDENCE_READY_FOR_COMPARATIVE_RESEARCH",
            "reason": "BOTH_MODEL_ERRORS_AND_TRADE_LINKAGE_AVAILABLE",
            "direction_error_rate_percent": direction["direction_error_rate_percent"],
            "structure_mean_absolute_range_error": structure["mean_absolute_range_error"],
            "eligible_for_candidate_selection": False,
            "limitations": "No causal attribution, benchmark superiority or independent holdout."}
