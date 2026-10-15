import unittest
from p3.historical_evaluation_window import historical_evaluation_window


class HistoricalWindowTests(unittest.TestCase):
    def setUp(self):
        self.rows = [{"timestamp_ms": i * 1000} for i in range(300)]

    def test_adjacent_windows_do_not_overlap(self):
        newest = historical_evaluation_window(
            self.rows, evaluation_bars=40, holding_bars=16, offset_bars=0)
        older = historical_evaluation_window(
            self.rows, evaluation_bars=40, holding_bars=16, offset_bars=40)
        self.assertEqual(newest, (244000, 283000))
        self.assertEqual(older, (204000, 243000))
        self.assertLess(older[1], newest[0])

    def test_insufficient_warmup_rejected(self):
        with self.assertRaises(ValueError):
            historical_evaluation_window(
                self.rows, evaluation_bars=40, holding_bars=16, offset_bars=200)

    def test_negative_offset_rejected(self):
        with self.assertRaises(ValueError):
            historical_evaluation_window(
                self.rows, evaluation_bars=40, holding_bars=16, offset_bars=-1)


if __name__ == "__main__":
    unittest.main()
