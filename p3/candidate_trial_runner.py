"""Isolated candidate trials: validation diagnostics only, never holdout selection."""
from .ai_training_pipeline import train_horizon
from .validation_selection import select_threshold
from .experiment_scheduler import eligible_candidate_trials


def evaluate_candidate_trials(schedule, *, symbol, years, candles_by_timeframe,
                              features_by_timeframe, fee_rate, trainer=train_horizon,
                              selector=select_threshold):
    """Evaluate at most one scheduled candidate per horizon.

    Callers must supply already-loaded native candles and point-in-time features.
    No holdout replay, model activation, paper trading, or order placement occurs.
    """
    from .multi_model_replay import STRATEGY_TIMEFRAMES
    results = []
    for trial in eligible_candidate_trials(schedule):
        strategy = trial["strategy"]
        if strategy not in STRATEGY_TIMEFRAMES:
            continue
        timeframe = STRATEGY_TIMEFRAMES[strategy]
        candles = candles_by_timeframe[timeframe]
        features = features_by_timeframe[timeframe]
        trained = trainer(features, candles, strategy, years=years,
                          model_params=trial["params"])
        actual_window = list(trained["windows"]["validation"])
        if actual_window != trial["validation_window"]:
            raise ValueError("validation window changed after preflight: " + strategy)
        selection = selector(candles, features, trained["model"], symbol,
                             trained["windows"]["validation"], fee_rate)
        threshold = selection.get("selected_threshold")
        winner = next((row for row in selection.get("candidates", [])
                       if row.get("threshold") == threshold), None)
        results.append({
            "strategy": strategy, "timeframe": timeframe,
            "params": trial["params"], "validation_window": actual_window,
            "selected_threshold": threshold,
            "validation_score": (
                winner["return_percent"] - winner["drawdown_percent"]
                if winner is not None else None),
            "validation_eligible": winner is not None,
            "validation_candidates": selection.get("candidates", []),
            "status": "VALIDATION_EVALUATED",
            "holdout_evaluated": False, "auto_promote": False,
            "paper_eligible": False,
        })
    return results
