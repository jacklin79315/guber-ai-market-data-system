"""Regression tests for validation-only independent-layer candidate exploration."""
import unittest
from p3.adaptive_trial_selection import next_layer_candidate


class AdaptiveLayerSelectionTests(unittest.TestCase):
    def test_no_eligible_validation_trial_means_no_proposal(self):
        self.assertIsNone(next_layer_candidate([]))

    def test_requires_diagnostics(self):
        trials = [{"status": "COMPLETE", "validation_eligible": True,
                   "validation_score": 2.0,
                   "params": {"max_iter": 100, "learning_rate": 0.1}}]
        self.assertIsNone(next_layer_candidate(trials))

    def test_explores_direction_without_mutating_baseline(self):
        base = {"max_iter": 100, "learning_rate": 0.1}
        trials = [{"status": "COMPLETE", "validation_eligible": True,
                   "validation_score": 2.0, "params": base,
                   "diagnostics": {"direction_brier_score": 0.2,
                                   "upside_mae_percent": 1.0,
                                   "downside_mae_percent": 1.2}}]
        candidate = next_layer_candidate(trials)
        self.assertEqual(candidate["direction_max_iter"], 120)
        self.assertEqual(candidate["structure_max_iter"], 100)
        self.assertEqual(base, {"max_iter": 100, "learning_rate": 0.1})

    def test_explores_structure_after_independent_trial(self):
        diag = {"direction_brier_score": 0.2,
                "upside_mae_percent": 1.0, "downside_mae_percent": 1.2}
        trials = [{"status": "COMPLETE", "validation_eligible": True,
                   "validation_score": 2.0,
                   "params": {"max_iter": 100, "learning_rate": 0.1},
                   "diagnostics": diag},
                  {"status": "COMPLETE", "validation_eligible": True,
                   "validation_score": 3.0,
                   "params": {"direction_max_iter": 120,
                              "direction_learning_rate": 0.1,
                              "structure_max_iter": 100,
                              "structure_learning_rate": 0.1},
                   "diagnostics": diag}]
        candidate = next_layer_candidate(trials)
        self.assertEqual(candidate["direction_max_iter"], 120)
        self.assertEqual(candidate["structure_max_iter"], 120)


if __name__ == "__main__":
    unittest.main()
