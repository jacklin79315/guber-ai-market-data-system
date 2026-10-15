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

    def test_duplicate_rejected(self):
        row = {"signal_time_ms": 1, "label_end_ms": 2, "direction": "LONG",
               "signal_features": {"x": 1.0}, "net_r": 0.1}
        with self.assertRaises(ValueError):
            chronological_paper_learning([row, row], ["x"], min_train=2)


if __name__ == "__main__":
    unittest.main()
