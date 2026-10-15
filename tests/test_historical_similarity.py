import unittest

from p3.historical_similarity import search_historical_analogs


class HistoricalSimilarityTests(unittest.TestCase):
    def test_future_and_unfinished_labels_never_enter_results(self):
        history = [
            {"timestamp_ms": 10, "label_end_ms": 20, "rsi": 30.0, "volume_ratio": 1.0},
            {"timestamp_ms": 80, "label_end_ms": 110, "rsi": 30.0, "volume_ratio": 1.0},
            {"timestamp_ms": 101, "label_end_ms": 120, "rsi": 30.0, "volume_ratio": 1.0},
        ]
        result = search_historical_analogs(
            {"rsi": 30.0, "volume_ratio": 1.0}, history,
            ["rsi", "volume_ratio"], asof_ms=100, horizon_ms=40, embargo_ms=5)
        self.assertEqual([x["timestamp_ms"] for x in result], [10])

    def test_closest_feature_pattern_wins(self):
        history = [
            {"timestamp_ms": 1, "label_end_ms": 2, "rsi": 30, "slope": -2},
            {"timestamp_ms": 3, "label_end_ms": 4, "rsi": 70, "slope": 2},
            {"timestamp_ms": 5, "label_end_ms": 6, "rsi": 31, "slope": -1.9},
        ]
        result = search_historical_analogs(
            {"rsi": 30, "slope": -2}, history, ["rsi", "slope"],
            asof_ms=20, horizon_ms=5, k=2)
        self.assertEqual([x["timestamp_ms"] for x in result], [1, 5])

    def test_rejects_incomplete_current_features(self):
        with self.assertRaises(ValueError):
            search_historical_analogs({}, [], ["rsi"], asof_ms=10, horizon_ms=2)


if __name__ == "__main__":
    unittest.main()
