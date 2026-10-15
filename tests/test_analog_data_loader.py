import unittest
from p3.analog_data_loader import load_research_history


class AnalogDataLoaderTests(unittest.TestCase):
    def test_read_only_and_scoped(self):
        calls = []
        def db(method, table, params):
            calls.append((method, table, params))
            if table == "market_features":
                return [{"symbol": "BTCUSDT", "timeframe": "1h",
                         "close_time": 3599999, "rsi_12": 35}]
            return [{"symbol": "BTCUSDT", "timeframe": "1h",
                     "open_time": 0, "close_time": 3599999,
                     "open_price": "100", "high_price": "110",
                     "low_price": "90", "close_price": "105"}]
        result = load_research_history(db, "BTCUSDT", "1h", asof_ms=3599999,
                                       features=("rsi_12",))
        self.assertEqual(result["feature_count"], 1)
        self.assertEqual(result["candle_count"], 1)
        self.assertTrue(all(method == "GET" for method, _, _ in calls))
        self.assertEqual(result["snapshots"][0]["timestamp_ms"], 3599999)

    def test_rejects_future_rows(self):
        def db(method, table, params):
            return [{"symbol": "BTCUSDT", "timeframe": "1h",
                     "close_time": 5000, "rsi_12": 35}]
        with self.assertRaises(ValueError):
            load_research_history(db, "BTCUSDT", "1h", asof_ms=100,
                                  features=("rsi_12",))


if __name__ == "__main__":
    unittest.main()
