"""Convert native Supabase raw_candles rows into P3B replay OHLC.

No timeframe synthesis, signal generation, or future-data interpolation.
"""
from .candle_execution import _validate_candle

def raw_row_to_candle(row):
    """Convert one raw_candles row; Binance close_time is inclusive (+1ms)."""
    result = {
        "open_time": int(row["open_time"]),
        "close_time": int(row["close_time"]),
        "open": float(row["open_price"]),
        "high": float(row["high_price"]),
        "low": float(row["low_price"]),
        "close": float(row["close_price"]),
    }
    _validate_candle(result)
    return result

INTERVAL_MS = {"15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000}

def raw_rows_to_candles(rows, *, symbol=None, timeframe=None):
    """Require one native series, strictly ordered and without duplicate bars."""
    output = []
    previous = None
    for row in rows:
        if symbol is not None and row["symbol"] != symbol:
            raise ValueError("unexpected symbol")
        if timeframe is not None and row["timeframe"] != timeframe:
            raise ValueError("unexpected timeframe")
        candle = raw_row_to_candle(row)
        if timeframe in INTERVAL_MS:
            interval = INTERVAL_MS[timeframe]
            if candle["close_time"] - candle["open_time"] + 1 != interval:
                raise ValueError("invalid native candle duration")
            if previous is not None and candle["open_time"] != previous["open_time"] + interval:
                raise ValueError("missing or unordered native candle")
        elif previous is not None and candle["open_time"] <= previous["close_time"]:
            raise ValueError("overlapping or unordered raw candles")
        output.append(candle)
        previous = candle
    return output
