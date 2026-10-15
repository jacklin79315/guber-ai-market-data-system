"""Chronological, non-overlapping research evaluation for a frozen analog plan.

This is a research report, NOT live trading and NOT a model-promotion gate.
Each decision sees only historical labels completed before its as-of time.
"""
from .analog_research_pipeline import research_analog_plan


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
    return {"direction": direction, "research_only": True,
            "evaluations": len(outcomes),
            "candidate_count": sum(x["decision"] == "CANDIDATE" for x in outcomes),
            "wait_count": sum(x["decision"] == "WAIT" for x in outcomes),
            "results": outcomes}
