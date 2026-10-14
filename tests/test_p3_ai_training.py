"""Regression tests for chronological ML split and learned trade decisions."""
import unittest
import numpy as np
from p3.ai_training_pipeline import chronological_windows, EMBARGO_MS
from p3.ai_decision_model import build_supervised_examples, HorizonModel

class TestAiTraining(unittest.TestCase):
    def test_three_year_windows_and_embargo(self):
        from datetime import datetime, timezone
        start = int(datetime(2023, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
        w = chronological_windows(start)
        self.assertEqual(w["train"][1], w["validation"][0])
        self.assertEqual(w["validation"][1], w["holdout"][0])
        self.assertEqual(w["holdout"][1], int(datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp() * 1000))
        self.assertEqual(EMBARGO_MS, 30 * 86400000)

    def test_two_year_default_windows(self):
        from datetime import datetime, timezone
        start = int(datetime(2024, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
        w = chronological_windows(start)
        self.assertEqual(w['train'][1], int(datetime(2025, 5, 1, tzinfo=timezone.utc).timestamp() * 1000))
        self.assertEqual(w['validation'][1], int(datetime(2025, 9, 1, tzinfo=timezone.utc).timestamp() * 1000))
        self.assertEqual(w['holdout'][1], int(datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp() * 1000))

    def test_targets_use_only_future_bars(self):
        candles = []
        features = []
        for i in range(10):
            close = 100 + i
            t = i * 60000
            candles.append({"open_time": t, "close_time": t + 59999,
                            "open": close, "high": close + 2,
                            "low": close - 2, "close": close})
            features.append({"close_time": t + 59999, "close_price": str(close)})
        X, y, up, down, times = build_supervised_examples(features, candles, 2)
        self.assertEqual(len(times), 8)
        self.assertEqual(times[0], 59999)
        self.assertAlmostEqual(up[0], 104 / 100 - 1)
        self.assertAlmostEqual(down[0], 1 - 99 / 100)
        self.assertEqual(y[0], 1)

    def test_untrained_model_cannot_decide(self):
        with self.assertRaisesRegex(ValueError, "not trained"):
            HorizonModel().decide("BTCUSDT", {"close_price": "100"})

if __name__ == "__main__":
    unittest.main()
