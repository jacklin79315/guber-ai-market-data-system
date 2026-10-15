"""Regression tests for stop-loss gap candles during paper replay."""
import unittest
from p3.paper_engine import PaperAccount, Decision
from p3.candle_execution import process_closed_candle


class StopGapTests(unittest.TestCase):
    def test_long_gap_below_stop(self):
        account = PaperAccount()
        account.enter(Decision("LONG", "BTCUSDT", 100.0, 110.0, 95.0, 0.5), 1000)
        result = process_closed_candle(account, {
            "open_time": 2000, "close_time": 2999,
            "open": 90.0, "high": 93.0, "low": 88.0, "close": 91.0,
        })
        self.assertEqual(result["reason"], "SL")
        self.assertTrue(result["mae_clipped_to_stop"])

    def test_short_gap_above_stop(self):
        account = PaperAccount()
        account.enter(Decision("SHORT", "BTCUSDT", 100.0, 90.0, 105.0, 0.5), 1000)
        result = process_closed_candle(account, {
            "open_time": 2000, "close_time": 2999,
            "open": 110.0, "high": 113.0, "low": 108.0, "close": 111.0,
        })
        self.assertEqual(result["reason"], "SL")
        self.assertTrue(result["mae_clipped_to_stop"])


if __name__ == "__main__":
    unittest.main()
