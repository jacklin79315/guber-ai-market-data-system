"""Frozen four-horizon analog research configuration; no execution."""
from .multi_model_replay import STRATEGY_TIMEFRAMES
from .raw_candle_adapter import INTERVAL_MS

# Research hypotheses, not validated optimal holding periods.
STRATEGY_PLANS = {
    "INTRADAY": {"timeframe": "15m", "max_holding_bars": 16},
    "ONE_TO_THREE_DAYS": {"timeframe": "1h", "max_holding_bars": 48},
    "ONE_WEEK": {"timeframe": "4h", "max_holding_bars": 42},
    "FIFTEEN_TO_THIRTY_DAYS": {"timeframe": "1d", "max_holding_bars": 21},
}
assert {k: v["timeframe"] for k, v in STRATEGY_PLANS.items()} == STRATEGY_TIMEFRAMES

def research_horizon_ms(strategy):
    plan = STRATEGY_PLANS[strategy]
    return plan["max_holding_bars"] * INTERVAL_MS[plan["timeframe"]]
