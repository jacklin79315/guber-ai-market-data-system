import unittest
from p3.paper_learning import chronological_direction_decisions


class PaperDirectionTests(unittest.TestCase):
    def test_choose_best_positive_forecast_not_actual_outcome(self):
        rows = [
            {"signal_time_ms": 10, "direction": "LONG",
             "prediction_net_r": .3, "actual_net_r": -1, "label_end_ms": 15},
            {"signal_time_ms": 10, "direction": "SHORT",
             "prediction_net_r": .2, "actual_net_r": 1, "label_end_ms": 15},
            {"signal_time_ms": 20, "direction": "LONG",
             "prediction_net_r": -.2, "actual_net_r": 1, "label_end_ms": 25},
            {"signal_time_ms": 20, "direction": "SHORT",
             "prediction_net_r": -.1, "actual_net_r": 1, "label_end_ms": 25},
        ]
        result = chronological_direction_decisions(rows)
        self.assertEqual(result["long_count"], 1)
        self.assertEqual(result["short_count"], 0)
        self.assertEqual(result["wait_count"], 1)
        self.assertEqual(result["realized_selected_mean_net_r"], -1)
        self.assertEqual(result["realized_total_net_r"], -1)
        self.assertEqual(result["realized_win_rate"], 0)
        self.assertEqual(result["max_closed_trade_drawdown_r"], 1)
        self.assertEqual(result["profit_factor"], 0)

    def test_opposite_direction_cannot_open_while_position_active(self):
        rows = [
            {"signal_time_ms": t, "direction": d,
             "prediction_net_r": pred, "actual_net_r": 1,
             "label_end_ms": t + 30}
            for t, values in [(10, [(.5, "LONG"), (.1, "SHORT")]),
                              (20, [(.1, "LONG"), (.5, "SHORT")])]
            for pred, d in values
        ]
        result = chronological_direction_decisions(rows)
        self.assertEqual(result["long_count"], 1)
        self.assertEqual(result["short_count"], 0)
        self.assertEqual(result["decisions"][1]["reason"], "existing_paper_position")

    def test_unpaired_forecast_waits(self):
        result = chronological_direction_decisions([
            {"signal_time_ms": 10, "direction": "LONG",
             "prediction_net_r": 1, "actual_net_r": 1}])
        self.assertEqual(result["wait_count"], 1)


if __name__ == "__main__":
    unittest.main()
