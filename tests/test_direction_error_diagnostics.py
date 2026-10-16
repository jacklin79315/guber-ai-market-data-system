import unittest
from p3.direction_error_diagnostics import diagnose_direction_predictions


class DirectionDiagnosticsTests(unittest.TestCase):
    def test_matured_horizon_only_and_brier(self):
        candles = [{"close_time": i, "close": 100 + i}
                   for i in range(1, 9)]
        predictions = [
            {"decision_time_ms": 2, "reference_price": 102,
             "probability_up": 0.8},
            {"decision_time_ms": 7, "reference_price": 107,
             "probability_up": 0.1},
        ]
        result = diagnose_direction_predictions(
            predictions, candles, 2, (1, 8))
        self.assertEqual(result["matched_predictions"], 1)
        self.assertEqual(result["skipped_predictions"], 1)
        self.assertAlmostEqual(result["mean_brier_score"], 0.04)
        self.assertEqual(result["direction_error_rate_percent"], 0)
        self.assertFalse(result["independent_validation_performed"])

    def test_empty_is_insufficient(self):
        result = diagnose_direction_predictions([], [], 2, (1, 8))
        self.assertEqual(result["status"],
                         "INSUFFICIENT_DIRECTION_PREDICTION_EVIDENCE")


if __name__ == "__main__":
    unittest.main()
