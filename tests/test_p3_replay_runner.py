import unittest
from p3.paper_engine import Decision
from p3.replay_runner import replay


def bar(start, end, lo, hi, close=100):
    return {"open_time": start, "close_time": end,
            "open": 100, "high": hi, "low": lo, "close": close}


class TestReplayRunner(unittest.TestCase):
    def test_entry_only_after_decision_and_exit_later(self):
        candles = [bar(1, 1000, 99, 101),
                   bar(1001, 2000, 99, 101),
                   bar(2001, 3000, 98, 111, 108)]
        d = Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        account, events = replay(candles, {1000: d})
        self.assertEqual([e["type"] for e in events], ["ENTRY", "EXIT"])
        self.assertEqual(events[0]["time_ms"], 1001)
        self.assertEqual(events[1]["reason"], "TP")
        self.assertAlmostEqual(account.cash, 10500)

    def test_entry_bar_does_not_trigger_exit(self):
        candles = [bar(1, 1000, 99, 101),
                   bar(1001, 2000, 94, 111, 108)]
        d = Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        account, events = replay(candles, {1000: d})
        self.assertEqual(len(events), 1)
        self.assertIsNotNone(account.position)

    def test_no_fill(self):
        candles = [bar(1, 1000, 99, 101),
                   bar(1001, 2000, 101, 105)]
        d = Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        account, events = replay(candles, {1000: d})
        self.assertEqual(events, [])
        self.assertEqual(account.cash, 10000)

    def test_wait(self):
        candles = [bar(1, 1000, 99, 101), bar(1001, 2000, 99, 101)]
        account, events = replay(candles, {1000: Decision("WAIT", "BTCUSDT")})
        self.assertEqual(events, [])
        self.assertIsNone(account.position)

    def test_reject_overlapping_bars(self):
        with self.assertRaises(ValueError):
            replay([bar(1, 1000, 99, 101), bar(1000, 2000, 99, 101)], {})


if __name__ == "__main__":
    unittest.main()
