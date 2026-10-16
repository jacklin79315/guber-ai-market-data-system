import unittest
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
