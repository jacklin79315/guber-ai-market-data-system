"""Read-only paginated PostgREST loader for P3A feature snapshots.

Requires an injected request function compatible with collector.db(method, table, params).
No secrets, network calls or writes are performed at import time.
"""
from .input_layer import TIMEFRAMES, INTERVAL_MS, assemble_observation, InsufficientHistory

STRATEGY_DECISION_TIMEFRAME = {
    "INTRADAY": "15m",
    "ONE_TO_THREE_DAYS": "1h",
    "ONE_WEEK": "4h",
    "FIFTEEN_TO_THIRTY_DAYS": "1d",
}


def load_observation(db, symbol, decision_time_ms, *, asset_metadata=None):
    """Read only rows available by the decision time; page daily ATR history.

    A 30-row daily ATR window plus one row per remaining timeframe suffices
    for one snapshot. The caller is responsible for passing an authorized
    read-only database client.
    """
    if not symbol or not isinstance(symbol, str):
        raise ValueError("symbol required")
    if not isinstance(decision_time_ms, int) or decision_time_ms <= 0:
        raise ValueError("decision_time_ms must be a positive integer")
    rows = {}
    for tf in TIMEFRAMES:
        count = 30 if tf == "1d" else 1
        # The 30 daily rows are fetched in descending order, then reversed.
        params = {
            "select": "*",
            "symbol": "eq." + symbol,
            "timeframe": "eq." + tf,
            "close_time": "lte." + str(decision_time_ms),
            "order": "close_time.desc",
            "limit": str(count),
        }
        result = db("GET", "market_features", params)
        if not isinstance(result, list) or len(result) < count:
            raise InsufficientHistory(f"missing {tf} observations")
        rows[tf] = list(reversed(result))
    return assemble_observation(symbol, decision_time_ms, rows,
                                asset_metadata=asset_metadata)
