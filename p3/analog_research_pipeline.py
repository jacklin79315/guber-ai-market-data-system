"""Read-only analog research pipeline: feature match -> fixed-plan outcomes -> score.

Research results are NEVER orders, live signals, or model promotion approvals.
All feature rows are closed-bar snapshots. Historical labels must finish before
the query time, and candidate plan parameters must be specified beforehand.
"""
from .historical_similarity import search_historical_analogs
from .historical_outcomes import build_historical_outcomes
from .analog_outcome_scoring import evaluate_analog_outcomes


def research_analog_plan(current, history, candles, features, *,
                         asof_ms, horizon_ms, direction, stop_pct, target_pct,
                         max_holding_bars, fee_rate=0.0, slippage_rate=0.0,
                         embargo_ms=0, k=100, min_samples=30,
                         min_net_expectancy_r=0.1):
    """Return WAIT or CANDIDATE for one PREDECLARED plan.

    Labeling requires full historical candles; selection uses ONLY features.
    Do not optimize on the same observations then call this out-of-sample.
    """
    neighbors = search_historical_analogs(
        current, history, features, asof_ms=asof_ms,
        horizon_ms=horizon_ms, embargo_ms=embargo_ms, k=k)
    by_time = {row["timestamp_ms"]: row for row in history}
    selected = [by_time[n["timestamp_ms"]] for n in neighbors]
    outcomes = build_historical_outcomes(
        selected, candles, direction=direction, stop_pct=stop_pct,
        target_pct=target_pct, max_holding_bars=max_holding_bars,
        fee_rate=fee_rate, slippage_rate=slippage_rate)
    # Outcomes ending after the query time cannot be used for scoring.
    cutoff = asof_ms - embargo_ms
    outcomes = {t: o for t, o in outcomes.items()
                if o["label_end_ms"] <= cutoff}
    result = evaluate_analog_outcomes(
        neighbors, outcomes, min_samples=min_samples,
        min_net_expectancy_r=min_net_expectancy_r)
    return {"direction": direction, "research_only": True,
            "auto_trade_enabled": False, "matched_neighbors": len(neighbors),
            **result}
