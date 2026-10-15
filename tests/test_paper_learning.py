import unittest
from p3.paper_learning import chronological_paper_learning


class PaperLearningTests(unittest.TestCase):
    def test_only_settled_past_outcomes_train(self):
        records = [
            {"signal_time_ms": i * 100, "label_end_ms": i * 100 + 150,
             "direction": "LONG", "signal_features": {"x": float(i)},
             "net_r": float(i % 3 - 1)}
            for i in range(8)
        ]
        result = chronological_paper_learning(records, ["x"], min_train=2)
        self.assertEqual(result["prediction_count"], 5)
        for row in result["predictions"]:
            self.assertLess(row["training_latest_label_end_ms"],
                            row["signal_time_ms"])
        self.assertIsNotNone(result["baseline_mean_absolute_error_r"])
        self.assertIsInstance(result["outperforms_baseline_mae"], bool)
        self.assertAlmostEqual(result["mae_improvement_r"], result["baseline_mean_absolute_error_r"] - result["mean_absolute_error_r"])
        self.assertTrue(result["research_only"])
        self.assertFalse(result["auto_trade_enabled"])

    def test_missing_features_are_excluded(self):
        rows = [
            {"signal_time_ms": i * 100, "label_end_ms": i * 100 + 10,
             "direction": "SHORT", "signal_features": {"x": None if i == 0 else float(i)},
             "net_r": 0.1}
            for i in range(6)
        ]
        result = chronological_paper_learning(rows, ["x"], min_train=2)
        self.assertEqual(result["prediction_count"], 3)

    def test_direction_changes_forecast_with_identical_market_features(self):
        rows = []
        for i in range(8):
            for direction, net_r in (("LONG", 1.0), ("SHORT", -1.0)):
                rows.append({"signal_time_ms": i * 100,
                             "label_end_ms": i * 100 + 10,
                             "direction": direction,
                             "signal_features": {"x": 5.0},
                             "net_r": net_r})
        result = chronological_paper_learning(rows, ["x"], min_train=4)
        final = [r for r in result["predictions"] if r["signal_time_ms"] == 700]
        self.assertEqual(len(final), 2)
        forecasts = {r["direction"]: r["prediction_net_r"] for r in final}
        self.assertGreater(forecasts["LONG"], forecasts["SHORT"])

    def test_historical_memory_trains_but_is_not_rescored(self):
        rows = [{"signal_time_ms": i * 100,
                 "label_end_ms": i * 100 + 10,
                 "direction": "LONG",
                 "signal_features": {"x": float(i)},
                 "net_r": float(i % 3 - 1)} for i in range(12)]
        result = chronological_paper_learning(
            rows, ["x"], min_train=2, evaluation_start_ms=900)
        self.assertEqual(result["prediction_count"], 3)
        self.assertEqual(result["available_training_observation_count"], 12)
        self.assertTrue(all(x["signal_time_ms"] >= 900
                            for x in result["predictions"]))
        self.assertTrue(all(x["training_latest_label_end_ms"] <
                            x["signal_time_ms"] for x in result["predictions"]))

    def test_settlement_boundary_and_out_of_order_labels(self):
        # Later signals can settle earlier; only genuinely matured labels count.
        rows = [
            {"signal_time_ms": 100, "label_end_ms": 900, "direction": "LONG",
             "signal_features": {"x": 1.0}, "net_r": 1.0},
            {"signal_time_ms": 200, "label_end_ms": 300, "direction": "SHORT",
             "signal_features": {"x": 2.0}, "net_r": -1.0},
            {"signal_time_ms": 350, "label_end_ms": 400, "direction": "LONG",
             "signal_features": {"x": 3.0}, "net_r": 0.5},
            {"signal_time_ms": 400, "label_end_ms": 450, "direction": "SHORT",
             "signal_features": {"x": 4.0}, "net_r": -0.5},
            {"signal_time_ms": 500, "label_end_ms": 550, "direction": "LONG",
             "signal_features": {"x": 5.0}, "net_r": 0.2},
        ]
        result = chronological_paper_learning(rows, ["x"], min_train=2)
        predictions = result["predictions"]
        self.assertEqual([p["signal_time_ms"] for p in predictions], [500])
        self.assertEqual(predictions[0]["train_count"], 3)
        self.assertEqual(predictions[0]["training_latest_label_end_ms"], 450)
        self.assertLess(predictions[0]["training_latest_label_end_ms"], 500)

    def test_unsettled_or_invalid_outcomes_cannot_train(self):
        rows = [
            {"signal_time_ms": i * 100, "label_end_ms": i * 100 + 20,
             "direction": "LONG", "signal_features": {"x": float(i)},
             "net_r": float("nan") if i == 1 else 0.1}
            for i in range(5)
        ]
        result = chronological_paper_learning(rows, ["x"], min_train=2)
        self.assertEqual(result["prediction_count"], 2)
        self.assertTrue(all(p["train_count"] >= 2 for p in result["predictions"]))

    def test_duplicate_rejected(self):
        row = {"signal_time_ms": 1, "label_end_ms": 2, "direction": "LONG",
               "signal_features": {"x": 1.0}, "net_r": 0.1}
        with self.assertRaises(ValueError):
            chronological_paper_learning([row, row], ["x"], min_train=2)


if __name__ == "__main__":
    unittest.main()
