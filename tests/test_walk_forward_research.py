"""Boundary regression tests for the 24-month research period."""
import unittest
from datetime import datetime, timezone
from p3.walk_forward_research import research_window, check_research_coverage


def ms(y, m, d):
    return int(datetime(y, m, d, tzinfo=timezone.utc).timestamp() * 1000)


class ResearchWindowTests(unittest.TestCase):
    def test_exact_24_calendar_months(self):
        self.assertEqual(research_window(ms(2026, 10, 1)),
                         (ms(2024, 10, 1), ms(2026, 10, 1)))

    def test_rejects_invalid_holdout_boundary(self):
        with self.assertRaises(ValueError):
            research_window(ms(2026, 10, 1) + 1)
        with self.assertRaises(TypeError):
            research_window(True)

    def test_rejects_month_of_history_as_two_years(self):
        start, end = research_window(ms(2026, 10, 1))
        candle = {"close_time": start + 900000 - 1}
        with self.assertRaisesRegex(ValueError, "insufficient 24-month"):
            check_research_coverage([candle], [candle], (start, end),
                                    timeframe="15m")


if __name__ == "__main__":
    unittest.main()
