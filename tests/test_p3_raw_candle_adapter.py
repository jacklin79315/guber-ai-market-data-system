import unittest
from p3.raw_candle_adapter import raw_row_to_candle, raw_rows_to_candles

def row(t, symbol="BTCUSDT", timeframe="15m"):
    return {"symbol": symbol, "timeframe": timeframe,
            "open_time": t, "close_time": t + 899999,
            "open_price": "100", "high_price": "110",
            "low_price": "90", "close_price": "101"}

class TestRawCandleAdapter(unittest.TestCase):
    def test_native_raw_prices(self):
        c = raw_row_to_candle(row(0))
        self.assertEqual(c["close"], 101)
        self.assertEqual(c["close_time"], 899999)

    def test_two_adjacent_binance_candles(self):
        candles = raw_rows_to_candles([row(0), row(900000)],
                                      symbol="BTCUSDT", timeframe="15m")
        self.assertEqual(len(candles), 2)

    def test_reject_duplicate_or_wrong_series(self):
        with self.assertRaises(ValueError):
            raw_rows_to_candles([row(0), row(0)])
        with self.assertRaises(ValueError):
            raw_rows_to_candles([row(0, "ETHUSDT")], symbol="BTCUSDT")

if __name__ == "__main__":
    unittest.main()
