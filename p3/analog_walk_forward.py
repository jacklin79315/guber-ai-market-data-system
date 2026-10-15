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
                                   evaluation_start_ms=None):
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
        report = research_analog_plan(
            current, ordered[:i], candles, features,
            asof_ms=asof, horizon_ms=horizon_ms,
            direction=direction, stop_pct=stop_pct, target_pct=target_pct,
            max_holding_bars=max_holding_bars, fee_rate=fee_rate,
            slippage_rate=slippage_rate, embargo_ms=embargo_ms,
            k=k, min_samples=min_samples)
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
    last_end = None
    for t in candidate_times:
        if t not in realized:
            continue
        if last_end is not None and t < last_end:
            continue
        selected.append(realized[t]["net_r"])
        last_end = realized[t]["label_end_ms"]
    return {"direction": direction, "research_only": True,
            "realized_candidate_count": len(selected),
            "unresolved_candidate_count": len(candidate_times) - len(realized),
            "realized_net_expectancy_r": sum(selected) / len(selected) if selected else None,
            "realized_win_rate": sum(v > 0 for v in selected) / len(selected) if selected else None,
            "realized_total_net_r": sum(selected),
            "evaluations": len(outcomes),
            "candidate_count": sum(x["decision"] == "CANDIDATE" for x in outcomes),
            "wait_count": sum(x["decision"] == "WAIT" for x in outcomes),
            "results": outcomes}
