"""P3A loader tests with a deterministic read-only fake."""
import unittest
from p3.feature_loader import load_observation, STRATEGY_DECISION_TIMEFRAME
from p3.input_layer import InsufficientHistory

DAY = 86400000


class TestFeatureLoader(unittest.TestCase):
    def test_strategy_mapping(self):
        self.assertEqual(list(STRATEGY_DECISION_TIMEFRAME.values()),
                         ["15m", "1h", "4h", "1d"])

    def test_only_get_and_as_of_cutoff(self):
        now = 31 * DAY
        calls = []
        def db(method, table, params):
            calls.append((method, table, params))
            tf = params["timeframe"][3:]
            if tf == "1d":
                return [{"symbol": "BTCUSDT", "timeframe": "1d",
                         "open_time": i * DAY, "close_time": (i + 1) * DAY - 1,
                         "atr_percent": 4.0} for i in reversed(range(1, 31))]
            return [{"symbol": "BTCUSDT", "timeframe": tf,
                     "open_time": now - 100, "close_time": now - 1,
                     "atr_percent": 4.0}]
        result = load_observation(db, "BTCUSDT", now)
        self.assertEqual(result["volatility"]["band"], "LOW")
        self.assertEqual(len(calls), 4)
        self.assertTrue(all(method == "GET" and table == "market_features"
                            and params["close_time"] == "lte." + str(now)
                            for method, table, params in calls))

    def test_incomplete_history_fails(self):
        with self.assertRaises(InsufficientHistory):
            load_observation(lambda *_: [], "BTCUSDT", 31 * DAY)


if __name__ == "__main__":
    unittest.main()
