import unittest

from p3.historical_outcomes import label_fixed_plan, build_historical_outcomes


def bar(i, o=100, h=101, l=99, c=100):
    return {"open_time": i * 10, "close_time": i * 10 + 9,
            "open": o, "high": h, "low": l, "close": c}


class HistoricalOutcomeTests(unittest.TestCase):
    def test_next_bar_entry_and_target(self):
        result = label_fixed_plan([bar(0, 80, 80, 80, 80),
                                   bar(1, 100, 104, 99, 103)],
                                  signal_close_ms=9, direction="LONG",
                                  stop_pct=.02, target_pct=.03, max_holding_bars=1)
        self.assertEqual(result["exit_reason"], "TP")
        self.assertAlmostEqual(result["net_r"], 1.5)
        self.assertEqual(result["label_end_ms"], 19)

    def test_both_barriers_conservative_stop(self):
        result = label_fixed_plan([bar(1, 100, 105, 95)],
                                  signal_close_ms=9, direction="LONG",
                                  stop_pct=.02, target_pct=.03, max_holding_bars=1)
        self.assertEqual(result["exit_reason"], "SL")
        self.assertTrue(result["ambiguous_bar"])
        self.assertAlmostEqual(result["net_r"], -1)

    def test_short_stop_and_costs(self):
        result = label_fixed_plan([bar(1, 100, 104, 97)],
                                  signal_close_ms=9, direction="SHORT",
                                  stop_pct=.02, target_pct=.03, max_holding_bars=1,
                                  fee_rate=.001, slippage_rate=.001)
        self.assertEqual(result["exit_reason"], "SL")
        self.assertLess(result["net_r"], -1)

    def test_gap_through_stop(self):
        result = label_fixed_plan([bar(1, 100, 101, 99),\n                                   bar(2, 95, 96, 94, 95)],
                                  signal_close_ms=9, direction="LONG",
                                  stop_pct=.02, target_pct=.03, max_holding_bars=1)
        self.assertAlmostEqual(result["net_r"], -2.5)

    def test_incomplete_future_is_not_labeled(self):
        self.assertIsNone(label_fixed_plan([bar(1)], signal_close_ms=9,
                         direction="LONG", stop_pct=.02, target_pct=.03,
                         max_holding_bars=2))

    def test_batch(self):
        result = build_historical_outcomes(
            [{"timestamp_ms": 9}], [bar(1)], direction="LONG",
            stop_pct=.02, target_pct=.03, max_holding_bars=1)
        self.assertIn(9, result)


if __name__ == "__main__":
    unittest.main()
