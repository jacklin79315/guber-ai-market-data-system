import unittest
from p3.paper_engine import Decision
from p3.replay_runner import replay, replay_with_metrics


def bar(start, end, lo, hi, close=100, opening=100):
    return {"open_time": start, "close_time": end,
            "open": opening, "high": hi, "low": lo, "close": close}


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

    def test_entry_bar_exit_uncertainty_is_reported(self):
        candles = [bar(1, 1000, 99, 101),
                   bar(1001, 2000, 94, 111, 108)]
        d = Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        result = replay_with_metrics(candles, {1000: d})
        self.assertEqual(result["metrics"]["entry_bars_with_unresolved_exit"], 1)
        self.assertTrue(result["metrics"]["execution_path_uncertain"])
        self.assertTrue(result["events"][0]["entry_bar_exit_unresolved"])
        self.assertTrue(result["metrics"]["has_open_position"])

    def test_short_entry_bar_exit_uncertainty_is_reported(self):
        candles = [bar(1, 1000, 99, 101),
                   bar(1001, 2000, 89, 106, 91)]
        d = Decision("SHORT", "BTCUSDT", 100, 90, 105, .5)
        result = replay_with_metrics(candles, {1000: d})
        self.assertEqual(result["metrics"]["entry_bars_with_unresolved_exit"], 1)
        self.assertTrue(result["metrics"]["execution_path_uncertain"])
        self.assertEqual([e["type"] for e in result["events"]], ["ENTRY"])

    def test_no_exit_touch_has_no_execution_path_uncertainty(self):
        candles = [bar(1, 1000, 99, 101),
                   bar(1001, 2000, 98, 104, 103)]
        d = Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        result = replay_with_metrics(candles, {1000: d})
        self.assertEqual(result["metrics"]["entry_bars_with_unresolved_exit"], 0)
        self.assertFalse(result["metrics"]["execution_path_uncertain"])

    def test_no_fill(self):
        candles = [bar(1, 1000, 99, 101),
                   bar(1001, 2000, 101, 105, 103, 102)]
        d = Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        account, events = replay(candles, {1000: d})
        self.assertEqual(events, [])
        self.assertEqual(account.cash, 10000)

    def test_wait(self):
        candles = [bar(1, 1000, 99, 101), bar(1001, 2000, 99, 101)]
        account, events = replay(candles, {1000: Decision("WAIT", "BTCUSDT")})
        self.assertEqual(events, [])
        self.assertIsNone(account.position)

    def test_open_position_mark_to_market(self):
        candles = [bar(1, 1000, 99, 101),
                   bar(1001, 2000, 99, 105, 104)]
        d = Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        result = replay_with_metrics(candles, {1000: d})
        m = result["metrics"]
        self.assertTrue(m["has_open_position"])
        self.assertAlmostEqual(m["final_mark_to_market_equity"], 10200)
        self.assertIsNone(m["annualized_return_percent"])
        self.assertGreater(m["mean_capital_utilization_percent"], 0)
        self.assertEqual(len(result["equity_curve"]), 2)

    def test_completed_trade_metrics(self):
        candles = [bar(1, 1000, 99, 101),
                   bar(1001, 2000, 99, 101),
                   bar(2001, 3000, 98, 111, 108)]
        d = Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        result = replay_with_metrics(candles, {1000: d})
        self.assertEqual(result["metrics"]["closed_trades"], 1)
        self.assertAlmostEqual(result["metrics"]["final_mark_to_market_equity"], 10500)
        self.assertIsNotNone(result["metrics"]["annualized_return_percent"])

    def test_first_candle_loss_counts_toward_drawdown(self):
        candles = [bar(1, 1000, 99, 101),
                   bar(1001, 2000, 96, 101, 97)]
        d = Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        result = replay_with_metrics(candles, {1000: d})
        self.assertAlmostEqual(
            result["metrics"]["max_close_to_close_drawdown_percent"], 1.5)
        self.assertAlmostEqual(
            result["metrics"]["final_mark_to_market_equity"], 9850)
        self.assertLess(
            result["metrics"]["annualized_mark_to_market_return_percent"], 0)
        self.assertTrue(result["events"][0]["entry_time_estimated"])

    def test_reject_overlapping_bars(self):
        with self.assertRaises(ValueError):
            replay([bar(1, 1000, 99, 101), bar(1000, 2000, 99, 101)], {})


if __name__ == "__main__":
    unittest.main()
