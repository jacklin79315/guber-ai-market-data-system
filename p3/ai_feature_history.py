"""Read-only historical feature loader for supervised AI training."""
from .native_history_replay import PAGE_SIZE
from .ai_decision_model import FEATURE_COLUMNS

def load_native_features(db, symbol, timeframe, *, start_ms=None, end_ms=None):
    if not symbol or timeframe not in ("15m", "1h", "4h", "1d"):
        raise ValueError("invalid feature series")
    result = []
    cursor = start_ms
    first_page = True
    while True:
        params = {
            "select": ",".join(("open_time", "close_time", "close_price") + FEATURE_COLUMNS),
            "source": "eq.BINANCE", "market": "eq.SPOT",
            "symbol": "eq." + symbol,
            "timeframe": "eq." + timeframe,
            "order": "open_time.asc", "limit": str(PAGE_SIZE),
        }
        if cursor is not None:
            params["open_time"] = ("gte." if first_page else "gt.") + str(cursor)
        if end_ms is not None:
            params["close_time"] = "lte." + str(end_ms)
        batch = db("GET", "market_features", params)
        if not isinstance(batch, list):
            raise ValueError("invalid feature response")
        if not batch:
            break
        if result and int(batch[0]["open_time"]) <= int(result[-1]["open_time"]):
            raise ValueError("unordered feature pages")
        result.extend(batch)
        cursor = int(batch[-1]["open_time"])
        first_page = False
        if len(batch) < PAGE_SIZE:
            break
    if not result:
        raise ValueError("missing training features")
    return result
