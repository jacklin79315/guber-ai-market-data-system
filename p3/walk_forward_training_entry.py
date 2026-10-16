"""Run 24-month walk-forward research without modifying the database."""
import json
import os
from .ai_training_pipeline import _add_months, DAY_MS
from .ai_feature_history import load_native_features
from .native_history_replay import load_native_candles
from .multi_model_replay import STRATEGY_TIMEFRAMES
from .walk_forward_research import research_window

STRATEGY_MONTHS = {"INTRADAY": 6, "ONE_TO_THREE_DAYS": 12,
                   "ONE_WEEK": 18, "FIFTEEN_TO_THIRTY_DAYS": 24}


def resolve_research_months(mode, strategy, custom=None):
    if strategy not in STRATEGY_MONTHS:
        raise ValueError("unsupported research strategy")
    if mode == "full":
        return 24
    if mode == "fast":
        return STRATEGY_MONTHS[strategy]
    if mode == "custom":
        if custom is None or str(custom).strip() == "":
            raise ValueError("custom mode requires a month value for each strategy")
        try:
            months = int(custom)
        except (TypeError, ValueError):
            raise ValueError("custom research months must be an integer") from None
        if str(months) != str(custom).strip() or not 1 <= months <= 24:
            raise ValueError("custom research months must be 1-24")
        return months
    raise ValueError("research mode must be fast, full or custom")
from .feedback_candidate_research import run_feedback_candidate_research
from .training_settings import load_training_settings
from .fee_schedule import load_fee_rate

def main():
    from collector import db
    settings = load_training_settings(db)
    strategy = os.environ["TRAINING_BATCH_STRATEGY"]
    timeframe = STRATEGY_TIMEFRAMES[strategy]
    iterations = int(os.environ.get("TRAINING_ITERATIONS", "10"))
    if not 1 <= iterations <= 10:
        raise ValueError("Research pilot supports one to ten candidates")
    symbol = settings["symbol"]
    candles = load_native_candles(db, symbol, timeframe)
    features = load_native_features(db, symbol, timeframe)
    end = ((int(candles[-1]["close_time"]) + 1) // DAY_MS) * DAY_MS
    holdout_start = _add_months(end, -4)
    mode = os.environ.get("RESEARCH_MODE", "full")
    months = resolve_research_months(mode, strategy,
                                     os.environ.get("RESEARCH_CUSTOM_MONTHS"))
    research = research_window(holdout_start, months=months)
    result = run_feedback_candidate_research(
        candles, features, strategy, research, max_new_candidates=iterations,
        fee_rate=load_fee_rate(db), slippage_rate=0.0, symbol=symbol)
    print(json.dumps({"status": "RESEARCH_COMPLETE", "symbol": symbol,
        "timeframe": timeframe, "research_mode": mode,
        "research_months": months, "holdout_start_ms": holdout_start,
        "holdout_end_ms": end, "holdout_used": False,
        "legacy_validation_split_used": False, **result}, allow_nan=False))

if __name__ == "__main__":
    main()
