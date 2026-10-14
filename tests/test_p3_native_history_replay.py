import unittest
from p3.native_history_replay import load_native_candles

class TestNativeHistoryReplay(unittest.TestCase):
    def test_keyset_pagination(self):
        calls = []
        def db(method, table, params):
            calls.append(params.copy())
            if len(calls) == 1:
                return [dict(symbol="BTCUSDT", timeframe="15m", open_time=0,
                             close_time=899999, open_price="100", high_price="101",
                             low_price="99", close_price="100")]
            return []
        candles = load_native_candles(db, "BTCUSDT", "15m", start_ms=0)
        self.assertEqual(len(candles), 1)
        self.assertEqual(calls[0]["open_time"], "gte.0")

if __name__ == "__main__":
    unittest.main()
