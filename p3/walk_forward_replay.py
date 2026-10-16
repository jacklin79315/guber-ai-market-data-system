"""Replay chronological walk-forward decisions through the approved multi-lot engine.

This is a research-only replay stage. Its outputs must not be presented as
independent validation or as evidence of trade-feedback learning.
"""
from .multi_position_replay import replay_multi_positions
from .walk_forward_decisions import generate_walk_forward_decisions
from .multi_model_replay import STRATEGY_TIMEFRAMES


def replay_walk_forward_research(candles, features, strategy, research, *,
                                 params=None, confidence_threshold=0.6,
                                 fee_rate=0.0, slippage_rate=0.0, symbol=None):
    """Fit point-in-time models and replay their decisions on native candles.

    Preserve the candle immediately before the research boundary as execution
    context only; do not include its trade in research metrics.
    """
    if strategy not in STRATEGY_TIMEFRAMES:
        raise ValueError("unsupported strategy")
    start, end = research
    research_candles = [c for c in candles
                        if start <= int(c["close_time"]) < end]
    if not research_candles:
        raise ValueError("no research candles to replay")
    # Native candle adapter intentionally stores OHLC only, not symbol.
    if not symbol:
        raise ValueError("symbol must be provided explicitly for native research replay")
    decision_result = generate_walk_forward_decisions(
        candles, features, strategy, research,
        params=params, confidence_threshold=confidence_threshold, symbol=symbol)
    decisions = decision_result["decisions"]
    # Replay only decisions whose execution candle is inside research.
    # Decisions on the final candle cannot fill within this interval.
    replay = replay_multi_positions(
        {symbol: research_candles},
        {symbol: decisions},
        fee_rate=fee_rate, slippage_rate=slippage_rate,
        settle_at_end=True)
    metrics = replay["metrics"]
    # Diagnostic evidence is retained only for 35%-40% drawdown research runs.
    from .walk_forward_diagnostics import diagnose_drawdown, diagnose_eligible_trades
    from .forecast_error_diagnostics import diagnose_price_range_predictions
    from .ai_decision_model import HORIZON_BARS
    structure_diagnosis = diagnose_price_range_predictions(
        decision_result.get("price_range_predictions", []), candles,
        HORIZON_BARS[strategy], research)
    from .direction_error_diagnostics import diagnose_direction_predictions
    direction_diagnosis = diagnose_direction_predictions(
        decision_result.get("direction_predictions", []), candles,
        HORIZON_BARS[strategy], research)
    from .walk_forward_diagnostics import audit_prediction_coverage
    prediction_coverage = audit_prediction_coverage(
        replay, decision_result.get('direction_predictions', []),
        decision_result.get('price_range_predictions', []))
    from .walk_forward_diagnostics import trade_prediction_rows
    trade_rows = trade_prediction_rows(
        replay, decision_result.get('direction_predictions', []),
        decision_result.get('price_range_predictions', []))
    from .walk_forward_diagnostics import diagnose_trade_prediction_outcomes
    trade_forecast_association = diagnose_trade_prediction_outcomes(trade_rows)
    from .walk_forward_diagnostics import diagnose_trade_structure_outcomes
    trade_structure_association = diagnose_trade_structure_outcomes(trade_rows)
    from .walk_forward_diagnostics import classify_research_evidence
    evidence_status = classify_research_evidence(prediction_coverage, direction_diagnosis, structure_diagnosis, trade_rows)
    from .walk_forward_diagnostics import audit_severe_drawdown
    severe_audit = audit_severe_drawdown(replay)
    diagnosis = diagnose_drawdown(replay)
    eligible_diagnosis = diagnose_eligible_trades(replay)
    return {
        "strategy": strategy,
        "timeframe": STRATEGY_TIMEFRAMES[strategy],
        "research_window": [start, end],
        "training_checkpoints": decision_result["checkpoints"],
        "research_candles": len(research_candles),
        "research_decisions": len(decisions),
        "research_trading_metrics": metrics,
        "drawdown_failure_diagnosis": diagnosis,
        "severe_drawdown_audit": severe_audit,
        "eligible_trade_diagnosis": eligible_diagnosis,
        "structure_prediction_diagnostics": structure_diagnosis,
        "direction_prediction_diagnostics": direction_diagnosis,
        "prediction_coverage_audit": prediction_coverage,
        "trade_prediction_records": trade_rows,
        "trade_forecast_association": trade_forecast_association,
        "trade_structure_association": trade_structure_association,
        "research_evidence_status": evidence_status,
        "research_signal_count": len(replay["signals"]),
        "research_trade_events": len(replay["events"]),
        "research_trades": metrics["normal_closed_trades"],
        "independent_validation_performed": False,
        "trade_feedback_optimization_performed": False,
        "eligible_for_promotion": False,
    }
