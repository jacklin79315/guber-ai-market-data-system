import unittest
from p3.analog_data_loader import load_research_history, DEFAULT_FEATURES


class AnalogDataLoaderTests(unittest.TestCase):
    def test_default_features_match_real_database_schema(self):
        self.assertIn("macd_histogram_change", DEFAULT_FEATURES)
        self.assertNotIn("macd_hist_change", DEFAULT_FEATURES)

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

    def test_keyset_pagination_uses_exclusive_lower_bound(self):
        calls = []
        def db(method, table, params):
            calls.append((table, dict(params)))
            if table == "market_features":
                if "and" not in params:
                    return [{"symbol": "BTCUSDT", "timeframe": "1h",
                             "close_time": 3599999, "rsi_12": 35}]
                return []
            if "and" not in params:
                return [{"symbol": "BTCUSDT", "timeframe": "1h",
                         "open_time": 0, "close_time": 3599999,
                         "open_price": "100", "high_price": "110",
                         "low_price": "90", "close_price": "105"}]
            return []
        result = load_research_history(db, "BTCUSDT", "1h",
                                       asof_ms=3599999, features=("rsi_12",),
                                       page_size=1)
        self.assertEqual(result["feature_count"], 1)
        self.assertEqual(result["candle_count"], 1)
        for _, params in calls:
            if "and" in params:
                self.assertEqual(params["and"],
                                 "(close_time.gt.3599999,close_time.lte.3599999)")
                self.assertNotIn("close_time", params)

    def test_rejects_missing_matching_native_candle(self):
        def db(method, table, params):
            if table == "market_features":
                return [{"symbol": "BTCUSDT", "timeframe": "1h",
                         "close_time": 7199999, "rsi_12": 35}]
            return [{"symbol": "BTCUSDT", "timeframe": "1h",
                     "open_time": 0, "close_time": 3599999,
                     "open_price": "100", "high_price": "110",
                     "low_price": "90", "close_price": "105"}]
        with self.assertRaisesRegex(ValueError, "aligned"):
            load_research_history(db, "BTCUSDT", "1h", asof_ms=7199999,
                                  features=("rsi_12",))

    def test_rejects_future_rows(self):
        def db(method, table, params):
            return [{"symbol": "BTCUSDT", "timeframe": "1h",
                     "close_time": 5000, "rsi_12": 35}]
        with self.assertRaises(ValueError):
            load_research_history(db, "BTCUSDT", "1h", asof_ms=100,
                                  features=("rsi_12",))


if __name__ == "__main__":
    unittest.main()
