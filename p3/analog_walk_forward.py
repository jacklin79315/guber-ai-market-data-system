"""Chronological, non-overlapping research evaluation for a frozen analog plan.

This is a research report, NOT live trading and NOT a model-promotion gate.
Each decision sees only historical labels completed before its as-of time.
"""
from .analog_research_pipeline import research_analog_plan
from .historical_outcomes import build_historical_outcomes


def walk_forward_analog_evaluation(snapshots, candles, features, *,
                                   horizon_ms, direction, stop_pct, target_pct,
                                   max_holding_bars, fee_rate, slippage_rate,
                                   embargo_ms=0, k=100, min_samples=30,
                                   evaluation_start_ms=None, evaluation_end_ms=None,
                                   exploration=False):
    if not snapshots or not features:
        raise ValueError("empty research input")
    ordered = sorted(snapshots, key=lambda s: s["timestamp_ms"])
    if len({s["timestamp_ms"] for s in ordered}) != len(ordered):
        raise ValueError("duplicate feature timestamp")
    outcomes = []
    for i, current in enumerate(ordered):
        asof = current["timestamp_ms"]
        if evaluation_start_ms is not None and asof < evaluation_start_ms:
            continue
        if evaluation_end_ms is not None and asof > evaluation_end_ms:
            continue
        report = research_analog_plan(
            current, ordered[:i], candles, features,
            asof_ms=asof, horizon_ms=horizon_ms,
            direction=direction, stop_pct=stop_pct, target_pct=target_pct,
            max_holding_bars=max_holding_bars, fee_rate=fee_rate,
            slippage_rate=slippage_rate, embargo_ms=embargo_ms,
            k=k, min_samples=min_samples)
        # Exploration records a paper hypothesis regardless of the strict gate.
        # This is NOT a trained model update or live execution.
        if exploration:
            report = {**report, "strict_decision": report["decision"],
                      "decision": "CANDIDATE",
                      "reason": "exploration_paper_only"}
        outcomes.append({"timestamp_ms": asof, **report})
    # Realized labels are computed only AFTER each chronological decision.
    # Do not use these labels to choose or tune the decision itself.
    candidate_times = [o["timestamp_ms"] for o in outcomes
                       if o["decision"] == "CANDIDATE"]
    realized = build_historical_outcomes(
        [{"timestamp_ms": t} for t in candidate_times], candles,
        direction=direction, stop_pct=stop_pct, target_pct=target_pct,
        max_holding_bars=max_holding_bars, fee_rate=fee_rate,
        slippage_rate=slippage_rate)
    selected = []
    trade_records = []
    # All labeled candidate snapshots are training observations, not executed positions.
    # Position overlap is enforced separately when evaluating a selected policy.
    snapshot_by_time = {s["timestamp_ms"]: s for s in ordered}
    last_end = None
    skipped_overlapping_candidates = 0
    training_records = []
    for t in candidate_times:
        if t not in realized:
            continue
        outcome = realized[t]
        decision = next(o for o in outcomes if o["timestamp_ms"] == t)
        training_records.append({
            "signal_time_ms": t, "direction": direction,
            "signal_features": {f: snapshot_by_time[t].get(f) for f in features},
            "strict_decision": decision.get("strict_decision", decision["decision"]),
            "historical_net_expectancy_r": decision.get("net_expectancy_r"),
            "historical_lower_bound_r": decision.get("lower_bound_r"),
            "historical_sample_count": decision.get("sample_count"),
            "net_r": outcome["net_r"], "label_end_ms": outcome["label_end_ms"],
            "entry_price": outcome["entry_price"],
            "exit_price": outcome["exit_price"],
            "exit_reason": outcome["exit_reason"],
            "ambiguous_bar": outcome["ambiguous_bar"],
        })
    for record in training_records:
        if last_end is not None and record["signal_time_ms"] < last_end:
            skipped_overlapping_candidates += 1
            continue
        trade_records.append(record)
        selected.append(record["net_r"])
        last_end = record["label_end_ms"]
    equity = 0.0
    peak = 0.0
    max_drawdown_r = 0.0
    for net_r in selected:
        equity += net_r
        peak = max(peak, equity)
        max_drawdown_r = max(max_drawdown_r, peak - equity)
    wins = sum(v for v in selected if v > 0)
    losses = -sum(v for v in selected if v < 0)
    return {"direction": direction, "research_only": True,
            "exploration_paper_only": exploration,
            "trade_records": trade_records,
            "training_records": training_records,
            "max_closed_trade_drawdown_r": max_drawdown_r if selected else None,
            "profit_factor": wins / losses if losses > 0 else None,
            "skipped_overlapping_candidates": skipped_overlapping_candidates,
            "realized_candidate_count": len(selected),
            "unresolved_candidate_count": len(candidate_times) - len(realized),
            "realized_net_expectancy_r": sum(selected) / len(selected) if selected else None,
            "realized_win_rate": sum(v > 0 for v in selected) / len(selected) if selected else None,
            "realized_total_net_r": sum(selected),
            "evaluations": len(outcomes),
            "candidate_count": sum(x["decision"] == "CANDIDATE" for x in outcomes),
            "wait_count": sum(x["decision"] == "WAIT" for x in outcomes),
            "results": outcomes}
