import unittest
from p3.paper_learning import chronological_direction_decisions


class PaperDirectionTests(unittest.TestCase):
    def test_choose_best_positive_forecast_not_actual_outcome(self):
        rows = [
            {"signal_time_ms": 10, "direction": "LONG",
             "prediction_net_r": .3, "actual_net_r": -1},
            {"signal_time_ms": 10, "direction": "SHORT",
             "prediction_net_r": .2, "actual_net_r": 1},
            {"signal_time_ms": 20, "direction": "LONG",
             "prediction_net_r": -.2, "actual_net_r": 1},
            {"signal_time_ms": 20, "direction": "SHORT",
             "prediction_net_r": -.1, "actual_net_r": 1},
        ]
        result = chronological_direction_decisions(rows)
        self.assertEqual(result["long_count"], 1)
        self.assertEqual(result["short_count"], 0)
        self.assertEqual(result["wait_count"], 1)
        self.assertEqual(result["realized_selected_mean_net_r"], -1)

    def test_unpaired_forecast_waits(self):
        result = chronological_direction_decisions([
            {"signal_time_ms": 10, "direction": "LONG",
             "prediction_net_r": 1, "actual_net_r": 1}])
        self.assertEqual(result["wait_count"], 1)


if __name__ == "__main__":
    unittest.main()
