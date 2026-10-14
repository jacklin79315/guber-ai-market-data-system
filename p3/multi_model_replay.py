"""Run four independent horizon strategies without sharing capital or positions.

The caller supplies native candles and already-generated, time-safe decisions.
This is a replay coordinator, not an AI policy or training implementation.
"""
from .replay_runner import replay_with_metrics

STRATEGY_TIMEFRAMES = {
    "INTRADAY": "15m",
    "ONE_TO_THREE_DAYS": "1h",
    "ONE_WEEK": "4h",
    "FIFTEEN_TO_THIRTY_DAYS": "1d",
}


def replay_four_models(candles_by_timeframe, decisions_by_strategy, *,
                       fee_rate=0.0, slippage_rate=0.0,
                       max_holding_ms_by_strategy=None, score_k=2.0):
    """Return independent replay results for all four model horizons.

    Each strategy starts with 10,000 USDT. No position, equity or
    decision state is shared between the four accounts.
    """
    horizons = max_holding_ms_by_strategy or {}
    results = {}
    for strategy, timeframe in STRATEGY_TIMEFRAMES.items():
        if timeframe not in candles_by_timeframe:
            raise ValueError(f"missing native candles: {timeframe}")
        if strategy not in decisions_by_strategy:
            raise ValueError(f"missing decisions: {strategy}")
        results[strategy] = replay_with_metrics(
            candles_by_timeframe[timeframe],
            decisions_by_strategy[strategy],
            fee_rate=fee_rate,
            slippage_rate=slippage_rate,
            max_holding_ms=horizons.get(strategy),
            score_k=score_k,
        )
    return results
