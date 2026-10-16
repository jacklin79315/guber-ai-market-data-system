"""Sequential candidate selection learns from actual preceding experiment scores."""
import unittest
from p3.adaptive_trial_selection import next_candidate


class AdaptiveTrialSelectionTests(unittest.TestCase):
    def setUp(self):
        self.grid = [
            {"max_iter": 60, "learning_rate": 0.025},
            {"max_iter": 100, "learning_rate": 0.05},
            {"max_iter": 140, "learning_rate": 0.075},
            {"max_iter": 180, "learning_rate": 0.1},
        ]

    def test_initial_trial_explores(self):
        self.assertEqual(next_candidate(self.grid, []), self.grid[0])

    def test_feedback_changes_next_trial(self):
        history = [{"params": self.grid[0], "status": "COMPLETE",
                    "validation_eligible": True, "validation_score": 1.0, "validation_drawdown_percent": 8, "validation_annualized_return_percent": 12, "validation_win_rate_percent": 75, "validation_mean_score_q": 68},
                   {"params": self.grid[3], "status": "COMPLETE",
                    "validation_eligible": True, "validation_score": 9.0, "validation_drawdown_percent": 8, "validation_annualized_return_percent": 15, "validation_win_rate_percent": 75, "validation_mean_score_q": 68}]
        self.assertEqual(next_candidate(self.grid, history), self.grid[2])

    def test_never_repeat_tried_candidate(self):
        history = [{"params": p, "status": "FAILED"} for p in self.grid]
        self.assertIsNone(next_candidate(self.grid, history))

    def test_ineligible_score_does_not_guide_search(self):
        history = [{"params": self.grid[0], "status": "COMPLETE",
                    "validation_eligible": False, "validation_score": 100}]
        self.assertEqual(next_candidate(self.grid, history), self.grid[1])


if __name__ == "__main__":
    unittest.main()
