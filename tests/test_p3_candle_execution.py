import unittest
from p3.paper_engine import Decision, PaperAccount
from p3.candle_execution import process_closed_candle


def candle(start, end, low, high, close_price=100, open_price=100):
    return {"open_time": start, "close_time": end, "open": open_price,
            "high": high, "low": low, "close": close_price}


class TestCandleExecution(unittest.TestCase):
    def setUp(self):
        self.a = PaperAccount()
        self.a.enter(Decision("LONG", "BTCUSDT", 100, 110, 95, .5), 0)

    def test_no_trigger(self):
        self.assertIsNone(process_closed_candle(self.a, candle(1, 10, 98, 105)))

    def test_dual_hit_close_near_tp(self):
        r = process_closed_candle(self.a, candle(1, 10, 94, 111, 108))
        self.assertEqual(r["reason"], "TP")
        self.assertTrue(r["ambiguous_fill"])

    def test_dual_hit_close_near_sl(self):
        r = process_closed_candle(self.a, candle(1, 10, 94, 111, 97))
        self.assertEqual(r["reason"], "SL")
        self.assertTrue(r["ambiguous_fill"])

    def test_dual_hit_exact_tie_is_sl(self):
        r = process_closed_candle(self.a, candle(1, 10, 94, 111, 102.5))
        self.assertEqual(r["reason"], "SL")

    def test_short_dual_hit_close_near_tp(self):
        a = PaperAccount()
        a.enter(Decision("SHORT", "ETHUSDT", 100, 90, 105, .5), 0)
        r = process_closed_candle(a, candle(1, 10, 89, 106, 91))
        self.assertEqual(r["reason"], "TP")
        self.assertTrue(r["ambiguous_fill"])

    def test_time_limit(self):
        r = process_closed_candle(self.a, candle(1, 10, 98, 105),
                                  max_exit_time_ms=10)
        self.assertEqual(r["reason"], "TIME_LIMIT")

    def test_reject_invalid_ohlc(self):
        with self.assertRaises(ValueError):
            process_closed_candle(self.a, {"open_time": 1, "close_time": 10})


if __name__ == "__main__":
    unittest.main()
