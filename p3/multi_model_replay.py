"""Four independent multi-position strategy portfolios.

Each horizon uses its own initial 10,000 USDT and settlement-based 80%
aggregate entry capacity. No shared cash and no live order placement.
"""
from .multi_position_replay import replay_multi_positions

STRATEGY_TIMEFRAMES = {
    "INTRADAY": "15m",
    "ONE_TO_THREE_DAYS": "1h",
    "ONE_WEEK": "4h",
    "FIFTEEN_TO_THIRTY_DAYS": "1d",
}


def replay_four_models(candles_by_timeframe, decisions_by_strategy, *,
                       fee_rate=0.0, slippage_rate=0.0,
                       max_holding_ms_by_strategy=None, score_k=2.0):
    """Replay each strategy independently with multiple concurrent lots.

    Candle inputs are symbol-keyed mappings for each native timeframe.
    Decisions are symbol-keyed mappings of prior-close timestamps.
    Holding-time exits are not implemented by the multi-lot executor; reject
    requested holding limits rather than silently ignoring them.
    """
    if max_holding_ms_by_strategy and any(
        value is not None for value in max_holding_ms_by_strategy.values()
    ):
        raise NotImplementedError("multi-lot maximum holding-time exits are not implemented")
    results = {}
    for strategy, timeframe in STRATEGY_TIMEFRAMES.items():
        if timeframe not in candles_by_timeframe:
            raise ValueError(f"missing native candles: {timeframe}")
        if strategy not in decisions_by_strategy:
            raise ValueError(f"missing decisions: {strategy}")
        candles = candles_by_timeframe[timeframe]
        decisions = decisions_by_strategy[strategy]
        if not isinstance(candles, dict) or not isinstance(decisions, dict):
            raise TypeError("multi-lot replay expects symbol-keyed candle and decision mappings")
        results[strategy] = replay_multi_positions(
            candles, decisions, fee_rate=fee_rate, slippage_rate=slippage_rate
        )
        results[strategy]["strategy"] = strategy
        results[strategy]["timeframe"] = timeframe
    return results
