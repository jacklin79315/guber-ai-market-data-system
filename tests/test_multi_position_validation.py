"""Tests for opt-in multi-position validation without fitting AI models."""
import unittest
from p3.paper_engine import Decision
from p3.multi_position_validation import evaluate_multi_lot_window
from p3.validation_window_diagnostics import EMBARGO_MS

DAY = 86400000


class FakeModel:
    def decide(self, symbol, row, *, confidence_threshold):
        return Decision("LONG", symbol, 100, 110, 90, 0.2)


class MultiPositionValidationTests(unittest.TestCase):
    def test_validation_only_and_multiple_entries(self):
        begin = 100 * DAY
        bars = []
        for i in range(4):
            t = begin + EMBARGO_MS + i * DAY
            bars.append({"open_time": t, "close_time": t + DAY - 1,
                         "open": 100, "high": 101, "low": 99, "close": 100})
        features = [{"close_time": c["close_time"]} for c in bars]
        result = evaluate_multi_lot_window(
            bars, features, FakeModel(), "BTCUSDT", (begin, begin + 120 * DAY),
            0.6, 0.0)
        self.assertEqual(result["open_lots"], 0)
        self.assertEqual(result["metrics"]["backtest_end_settlement_count"], 3)
        self.assertEqual(result["metrics"]["closed_trades"], 3)
        self.assertEqual(result["coverage"]["selected_candles"], 4)
        self.assertEqual(result["metrics"]["signal_counts"]["FILLED"], 3)


if __name__ == "__main__":
    unittest.main()
