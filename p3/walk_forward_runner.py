"""Research-only entrypoint for four independent 24-month walk-forward studies.

Explicit holdout boundary keeps research optimization away from future data.
This does not replace the production training workflow or write to Supabase.
"""
import json
from .native_history_replay import load_native_candles
from .ai_feature_history import load_native_features
from .fee_schedule import load_fee_rate
from .multi_model_replay import STRATEGY_TIMEFRAMES
from .walk_forward_research import research_window
from .walk_forward_feedback import run_research_iterations


def run_four_strategy_research(db, *, symbol, holdout_start_ms,
                               iterations=5):
    research = research_window(holdout_start_ms)
    fee_rate = load_fee_rate(db)
    results = {}
    for strategy, timeframe in STRATEGY_TIMEFRAMES.items():
        candles = load_native_candles(db, symbol, timeframe,
                                     end_ms=research[1] - 1)
        features = load_native_features(db, symbol, timeframe,
                                       end_ms=research[1] - 1)
        results[strategy] = run_research_iterations(
            candles, features, strategy, research,
            iterations=iterations, fee_rate=fee_rate, symbol=symbol)
    return {"symbol": symbol, "research_window": list(research),
            "strategies": results,
            "independent_validation_performed": False,
            "eligible_for_promotion": False}


def main():
    import os
    from collector import db
    from .training_settings import load_training_settings
    settings = load_training_settings(db)
    boundary = os.getenv("RESEARCH_HOLDOUT_START_MS")
    if boundary is None:
        raise ValueError("RESEARCH_HOLDOUT_START_MS must be explicitly provided")
    result = run_four_strategy_research(
        db, symbol=settings["symbol"], holdout_start_ms=int(boundary),
        iterations=int(os.getenv("RESEARCH_ITERATIONS", "5")))
    print(json.dumps(result, allow_nan=False), flush=True)


if __name__ == "__main__":
    main()
