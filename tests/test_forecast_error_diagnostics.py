import unittest
from p3.forecast_error_diagnostics import diagnose_price_range_predictions


class ForecastErrorDiagnosticsTests(unittest.TestCase):
    def test_scores_only_matured_research_horizons(self):
        candles = [{"close_time": i, "high": 101, "low": 99}
                   for i in range(1, 9)]
        predictions = [
            {"decision_time_ms": 2, "reference_price": 100,
             "predicted_upper_bound": 102, "predicted_lower_bound": 98},
            {"decision_time_ms": 7, "reference_price": 100,
             "predicted_upper_bound": 102, "predicted_lower_bound": 98},
        ]
        result = diagnose_price_range_predictions(
            predictions, candles, 2, (1, 8))
        self.assertEqual(result["matched_predictions"], 1)
        self.assertEqual(result["skipped_predictions"], 1)
        self.assertAlmostEqual(result["mean_absolute_range_error"], 0.01)
        self.assertFalse(result["independent_validation_performed"])

    def test_no_matured_predictions(self):
        result = diagnose_price_range_predictions([], [], 2, (1, 8))
        self.assertEqual(result["status"],
                         "INSUFFICIENT_STRUCTURE_PREDICTION_EVIDENCE")
        self.assertIsNone(result["mean_absolute_range_error"])


if __name__ == "__main__":
    unittest.main()
