"""Chronological, point-in-time model decisions for 24-month research replay.

At each monthly checkpoint fit only labels whose future horizon is already
closed. Decisions use the checkpoint model and features at each candle close.
This produces replay inputs; it does not itself optimize on trade feedback.
"""
from datetime import datetime, timezone
from .ai_decision_model import HorizonModel, HORIZON_BARS, build_supervised_examples
from .ai_training_pipeline import _add_months
from .multi_model_replay import STRATEGY_TIMEFRAMES
from .walk_forward_research import check_research_coverage


def monthly_checkpoints(start_ms, end_ms):
    points = [start_ms]
    while points[-1] < end_ms:
        next_point = _add_months(points[-1], 1)
        points.append(min(next_point, end_ms))
    return list(zip(points, points[1:]))


def generate_walk_forward_decisions(candles, features, strategy, research, *,
                                    params=None, confidence_threshold=0.6, symbol=None):
    """Return decisions and an auditable model-fit timeline.

    Future labels may be calculated in memory, but only labels completed
    before each checkpoint are ever passed into model.fit.
    """
    timeframe = STRATEGY_TIMEFRAMES[strategy]
    if not symbol:
        raise ValueError("symbol is required for native candle decisions")
    check_research_coverage(candles, features, research, timeframe=timeframe)
    horizon = HORIZON_BARS[strategy]
    interval = {"15m": 900000, "1h": 3600000,
                "4h": 14400000, "1d": 86400000}[timeframe]
    X, y, up, down, times = build_supervised_examples(features, candles, horizon)
    rows = {int(f["close_time"]): f for f in features}
    decisions, checkpoints = {}, []
    start, end = research
    for begin, finish in monthly_checkpoints(start, end):
        # The last label candle must have closed before this model is fitted.
        train_indices = [i for i, t in enumerate(times)
                         if t + horizon * interval < begin]
        if len(train_indices) < 100 or len(set(y[train_indices])) < 2:
            checkpoints.append({"start_ms": begin, "end_ms": finish,
                                "training_samples": len(train_indices),
                                "status": "INSUFFICIENT_PRIOR_LABELS"})
            continue
        model = HorizonModel(**(params or {})).fit(
            X[train_indices], y[train_indices],
            up[train_indices], down[train_indices])
        n = 0
        for candle in candles:
            t = int(candle["close_time"])
            if not begin <= t < finish or t not in rows:
                continue
            decisions[t] = model.decide(
                symbol, rows[t],
                confidence_threshold=confidence_threshold)
            n += 1
        checkpoints.append({"start_ms": begin, "end_ms": finish,
                            "training_samples": len(train_indices),
                            "last_training_label_close_ms": (
                                max(times[i] for i in train_indices)
                                + horizon * interval),
                            "decisions": n, "status": "FITTED"})
    return {"decisions": decisions, "checkpoints": checkpoints,
            "research_window": [start, end],
            "strategy": strategy, "timeframe": timeframe,
            "independent_validation_performed": False,
            "trade_feedback_optimization_performed": False}
