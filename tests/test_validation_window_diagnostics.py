import unittest
from p3.validation_window_diagnostics import audit_validation_window
from p3.ai_training_pipeline import EMBARGO_MS

DAY = 86400000


class ValidationWindowAuditTests(unittest.TestCase):
    def test_reports_effective_span_and_missing_features(self):
        begin = 100 * DAY
        candles = [
            {"open_time": begin + EMBARGO_MS + i * DAY,
             "close_time": begin + EMBARGO_MS + (i + 1) * DAY - 1}
            for i in range(3)
        ]
        features = [{"close_time": candles[0]["close_time"]}]
        result = audit_validation_window(candles, features, (begin, begin + 120 * DAY))
        self.assertEqual(result["planned_window_days"], 120)
        self.assertEqual(result["after_embargo_days"], 90)
        self.assertEqual(result["selected_candles"], 3)
        self.assertEqual(result["feature_matched"], 1)
        self.assertEqual(result["feature_missing"], 2)
        self.assertEqual(result["selected_span_days"], 3)


if __name__ == "__main__":
    unittest.main()
