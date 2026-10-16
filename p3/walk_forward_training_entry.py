"""Run 24-month walk-forward research without modifying the database."""
import json
import os
from .ai_training_pipeline import _add_months, DAY_MS
from .ai_feature_history import load_native_features
from .native_history_replay import load_native_candles
from .multi_model_replay import STRATEGY_TIMEFRAMES
from .walk_forward_research import research_window
from .walk_forward_feedback import run_research_iterations
from .training_settings import load_training_settings
from .fee_schedule import load_fee_rate

def main():
    from collector import db
    settings = load_training_settings(db)
    strategy = os.environ["TRAINING_BATCH_STRATEGY"]
    timeframe = STRATEGY_TIMEFRAMES[strategy]
    iterations = int(os.environ.get("TRAINING_ITERATIONS", "5"))
    if iterations != 5:
        raise ValueError("Pilot supports five iterations")
    symbol = settings["symbol"]
    candles = load_native_candles(db, symbol, timeframe)
    features = load_native_features(db, symbol, timeframe)
    end = ((int(candles[-1]["close_time"]) + 1) // DAY_MS) * DAY_MS
    holdout_start = _add_months(end, -4)
    research = research_window(holdout_start)
    result = run_research_iterations(
        candles, features, strategy, research, iterations=iterations,
        fee_rate=load_fee_rate(db), symbol=symbol)
    print(json.dumps({"status": "RESEARCH_COMPLETE", "symbol": symbol,
        "timeframe": timeframe, "holdout_start_ms": holdout_start,
        "holdout_end_ms": end, "holdout_used": False,
        "legacy_validation_split_used": False, **result}, allow_nan=False))

if __name__ == "__main__":
    main()
