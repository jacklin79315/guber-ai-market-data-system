"""Boundary regression tests for the 24-month research period."""
import unittest
from datetime import datetime, timezone
from p3.walk_forward_research import research_window, check_research_coverage
from p3.walk_forward_training_entry import resolve_research_months


def ms(y, m, d):
    return int(datetime(y, m, d, tzinfo=timezone.utc).timestamp() * 1000)


class ResearchWindowTests(unittest.TestCase):
    def test_exact_24_calendar_months(self):
        self.assertEqual(research_window(ms(2026, 10, 1)),
                         (ms(2024, 10, 1), ms(2026, 10, 1)))

    def test_selectable_months_keep_holdout_boundary(self):
        for months in (6, 12, 18, 24):
            start, end = research_window(ms(2026, 10, 1), months=months)
            self.assertEqual(end, ms(2026, 10, 1))
            self.assertLess(start, end)
        self.assertEqual(research_window(ms(2026, 10, 1), months=6)[0],
                         ms(2026, 4, 1))

    def test_mode_resolution(self):
        strategies = ("INTRADAY", "ONE_TO_THREE_DAYS", "ONE_WEEK", "FIFTEEN_TO_THIRTY_DAYS")
        self.assertEqual([resolve_research_months("fast", x) for x in strategies],
                         [6, 12, 18, 24])
        self.assertEqual([resolve_research_months("full", x) for x in strategies],
                         [24, 24, 24, 24])
        self.assertEqual(resolve_research_months("custom", "INTRADAY", "9"), 9)
        for invalid in ("0", "25", "1.5", "", "abc"):
            with self.assertRaises(ValueError):
                resolve_research_months("custom", "INTRADAY", invalid)
        with self.assertRaises(ValueError):
            research_window(ms(2026, 10, 1), months=25)

    def test_rejects_invalid_holdout_boundary(self):
        with self.assertRaises(ValueError):
            research_window(ms(2026, 10, 1) + 1)
        with self.assertRaises(TypeError):
            research_window(True)

    def test_rejects_month_of_history_as_two_years(self):
        start, end = research_window(ms(2026, 10, 1))
        candle = {"close_time": start + 900000 - 1}
        with self.assertRaisesRegex(ValueError, "invalid native continuity/alignment"):
            check_research_coverage([candle], [candle], (start, end),
                                    timeframe="15m")


if __name__ == "__main__":
    unittest.main()
