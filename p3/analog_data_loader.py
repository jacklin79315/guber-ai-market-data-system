"""Read-only, keyset-paginated historical research feed from Supabase PostgREST.

The injected db callable has signature db("GET", table, params). All results
are scoped to symbol/timeframe and closed candles, with no writes.
"""
from .raw_candle_adapter import raw_rows_to_candles


DEFAULT_FEATURES = (
    "rsi_12", "rsi_12_change", "macd_histogram", "macd_hist_change",
    "adx_14", "atr_percent", "volume_ratio", "return_3",
    "ema_slope_20", "body_ratio",
)


def _fetch_pages(db, table, symbol, timeframe, *, asof_ms, fields,
                 page_size=1000, max_pages=200):
    if page_size < 1 or page_size > 1000 or max_pages < 1:
        raise ValueError("invalid pagination")
    rows = []
    last = None
    for _ in range(max_pages):
        params = {
            "select": ",".join(fields),
            "symbol": "eq." + symbol,
            "timeframe": "eq." + timeframe,
            "close_time": "lte." + str(asof_ms),
            "order": "close_time.asc",
            "limit": str(page_size),
        }
        if last is not None:
            # PostgREST multiple constraints on one field use and=...
            params.pop("close_time")
            params["and"] = "(close_time.gt." + str(last) + ",close_time.lte." + str(asof_ms) + ")"
        page = db("GET", table, params)
        if not isinstance(page, list):
            raise ValueError("unexpected database response")
        if not page:
            return rows
        for row in page:
            t = row["close_time"]
            if not isinstance(t, int) or t > asof_ms or (last is not None and t <= last):
                raise ValueError("out of order or future row")
            if row["symbol"] != symbol or row["timeframe"] != timeframe:
                raise ValueError("wrong research series")
            if rows and t <= rows[-1]["close_time"]:
                raise ValueError("duplicate or unordered row")
            rows.append(row)
        last = rows[-1]["close_time"]
        if len(page) < page_size:
            return rows
    raise ValueError("research pagination limit reached")


def load_research_history(db, symbol, timeframe, *, asof_ms,
                          features=DEFAULT_FEATURES, page_size=1000,
                          max_pages=200):
    if not symbol or not timeframe or not isinstance(asof_ms, int) or isinstance(asof_ms, bool):
        raise ValueError("invalid research scope")
    feature_fields = ["symbol", "timeframe", "close_time", *features]
    feature_rows = _fetch_pages(
        db, "market_features", symbol, timeframe, asof_ms=asof_ms,
        fields=feature_fields, page_size=page_size, max_pages=max_pages)
    candle_fields = ["symbol", "timeframe", "open_time", "close_time",
                     "open_price", "high_price", "low_price", "close_price"]
    candle_rows = _fetch_pages(
        db, "raw_candles", symbol, timeframe, asof_ms=asof_ms,
        fields=candle_fields, page_size=page_size, max_pages=max_pages)
    candles = raw_rows_to_candles(candle_rows, symbol=symbol, timeframe=timeframe)
    snapshots = [{"timestamp_ms": row["close_time"],
                  **{name: row.get(name) for name in features}}
                 for row in feature_rows]
    # Each feature snapshot must correspond to an original closed native bar.
    native_times = {c["close_time"] for c in candles}
    if any(s["timestamp_ms"] not in native_times for s in snapshots):
        raise ValueError("feature/native candle timestamps are not aligned")
    return {"snapshots": snapshots, "candles": candles,
            "feature_count": len(snapshots), "candle_count": len(candles)}
