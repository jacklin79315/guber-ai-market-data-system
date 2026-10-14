import unittest
from p3.paper_engine import Decision, PaperAccount
from p3.replay_entry import try_enter_next_candle


class TestNextCandleEntry(unittest.TestCase):
    def setUp(self):
        self.d = Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        self.a = PaperAccount()
        self.c = {"open_time": 1001, "close_time": 2000, "open": 102,
                  "high": 105, "low": 99, "close": 104}

    def test_fills_only_when_price_touched(self):
        p = try_enter_next_candle(self.a, self.d, 1000, self.c)
        self.assertAlmostEqual(p.entry_price, 100)
        self.assertEqual(p.entry_time_ms, 1001)

    def test_no_fill_outside_range(self):
        self.c["low"] = 101
        self.assertIsNone(try_enter_next_candle(self.a, self.d, 1000, self.c))
        self.assertIsNone(self.a.position)

    def test_reject_decision_candle(self):
        self.c["open_time"] = 1
        with self.assertRaises(ValueError):
            try_enter_next_candle(self.a, self.d, 1000, self.c)

    def test_reject_skipped_candle(self):
        self.c["open_time"] = 2001
        self.c["close_time"] = 3000
        with self.assertRaises(ValueError):
            try_enter_next_candle(self.a, self.d, 1000, self.c)

    def test_wait_never_enters(self):
        self.assertIsNone(try_enter_next_candle(self.a, Decision("WAIT", "BTCUSDT"), 1000, self.c))


if __name__ == "__main__":
    unittest.main()
