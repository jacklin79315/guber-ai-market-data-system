import unittest
from p3.walk_forward_diagnostics import audit_prediction_coverage, trade_prediction_rows
from p3.feedback_candidate_generator import DEFAULT_LAYER_PARAMS, next_feedback_candidate, next_structure_candidate


def row(dd=10):
    return {"trial_index": 1, "params": dict(DEFAULT_LAYER_PARAMS),
            "metrics": {"annualized_return_percent": -5,
                        "win_rate_percent": 60, "mean_score_q": 65,
                        "normal_closed_trades": 10,
                        "max_close_to_close_drawdown_percent": dd,
                        "ambiguous_exit_count": 0},
            "eligible_trade_diagnosis": {"by_direction": {
                "LONG": {"closed": 10, "win_rate_percent": 30,
                         "net_pnl": -50}}}}


class CandidateGenerationTests(unittest.TestCase):
    def test_trade_prediction_rows_join_by_decision_time(self):
        replay = {"events": [
            {"type": "ENTRY", "lot_id": 4, "decision_time_ms": 10, "side": "LONG"},
            {"type": "EXIT", "lot_id": 4, "entry_price": 100,
             "exit_price": 103, "net_pnl": 3, "reason": "TP"},
            {"type": "BACKTEST_END_SETTLEMENT", "lot_id": 5}]}
        rows = trade_prediction_rows(
            replay, [{"decision_time_ms": 10, "probability_up": 0.7}],
            [{"decision_time_ms": 10, "predicted_upper_bound": 104,
              "predicted_lower_bound": 98}])
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["forecast_pair_complete"])
        self.assertEqual(rows[0]["probability_up"], 0.7)

    def test_forecast_coverage_counts_missing_entries(self):
        replay = {"events": [{"type": "ENTRY", "decision_time_ms": 10},
                             {"type": "ENTRY", "decision_time_ms": 20}]}
        audit = audit_prediction_coverage(
            replay, [{"decision_time_ms": 10}], [{"decision_time_ms": 20}])
        self.assertEqual(audit["entry_events"], 2)
        self.assertEqual(audit["matched_both"], 0)
        self.assertEqual(audit["missing_direction"], 1)
        self.assertFalse(audit["eligible_for_candidate_selection"])

    def test_rejects_disqualified_feedback(self):
        self.assertEqual(next_feedback_candidate([row(41)])["status"],
                         "NO_ELIGIBLE_FEEDBACK")

    def test_direction_requires_prediction_evidence(self):
        self.assertEqual(next_feedback_candidate([row()])["status"],
                         "MISSING_DIRECTION_PREDICTION_EVIDENCE")

    def test_structure_requires_evidence(self):
        self.assertEqual(next_structure_candidate([row()])["status"],
                         "MISSING_STRUCTURE_PREDICTION_EVIDENCE")

    def test_structure_changes_only_structure_parameter(self):
        source = row()
        source["structure_prediction_diagnostics"] = {
            "matched_predictions": 10, "mean_absolute_range_error": 0.02}
        choice = next_structure_candidate([source])
        self.assertEqual(choice["status"], "CANDIDATE_READY")
        self.assertEqual(choice["target_layer"], "STRUCTURE")
        self.assertTrue(choice["changed_field"].startswith("structure_"))

    def test_stop_events_alone_cannot_trigger_structure_tuning(self):
        source = row()
        source["eligible_trade_diagnosis"]["by_direction"]["LONG"]["stop_losses"] = 10
        self.assertEqual(next_structure_candidate([source])["status"],
                         "MISSING_STRUCTURE_PREDICTION_EVIDENCE")

    def test_changes_only_one_approved_parameter(self):
        source = row()
        source["direction_prediction_diagnostics"] = {
            "matched_predictions": 10, "direction_error_rate_percent": 40.0}
        choice = next_feedback_candidate([source])
        self.assertEqual(choice["status"], "CANDIDATE_READY")
        changed = [key for key in DEFAULT_LAYER_PARAMS
                   if choice["candidate"][key] != DEFAULT_LAYER_PARAMS[key]]
        self.assertEqual(changed, [choice["changed_field"]])
        self.assertEqual(choice["target_layer"], "DIRECTION")


if __name__ == "__main__":
    unittest.main()
