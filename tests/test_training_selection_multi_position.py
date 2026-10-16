"""Ensure actual autonomous selection uses multi-position account results."""
import unittest
from p3.paper_engine import Decision
from p3.validation_selection import evaluate_window, select_threshold


class AlwaysLong:
    def decide(self, symbol, row, confidence_threshold):
        return Decision("LONG", symbol, 100, 120, 80, .2)

    def analyze_direction(self, row):
        return 0.9


class TrainingSelectionMultiPositionTests(unittest.TestCase):
    def test_validation_replay_can_hold_multiple_lots(self):
        day = 86400000
        start = 100 * day
        candles = [
            {"open_time": start + i * day, "close_time": start + (i + 1) * day - 1,
             "open": 100, "high": 101, "low": 99, "close": 100}
            for i in range(5)
        ]
        features = [{"close_time": bar["close_time"]} for bar in candles]
        window = (start - 30 * day, start + 6 * day)
        result = evaluate_window(candles, features, AlwaysLong(), "BTCUSDT", window, .55, 0)
        self.assertEqual(len(result["account"].positions), 0)
        self.assertEqual(result["metrics"]["backtest_end_settlement_count"], 4)
        self.assertEqual(result["metrics"]["normal_closed_trades"], 0)
        self.assertAlmostEqual(result["account"].capacity_limit, 8000)
        self.assertEqual(result["metrics"]["closed_trades"], 4)
        selection = select_threshold(candles, features, AlwaysLong(), "BTCUSDT", window, 0)
        self.assertEqual(len(selection["candidates"]), 4)
        self.assertTrue(all(c["closed_trades"] == 4 for c in selection["candidates"]))
        self.assertTrue(all(c["backtest_end_settlement_percent"] == 100 for c in selection["candidates"]))


if __name__ == "__main__":
    unittest.main()
