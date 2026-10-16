import unittest
from p3.same_window_promotion import decide_generation_promotion

BASE = {"return_percent": 3.0, "drawdown_percent": 2.0,
        "closed_trades": 10, "execution_path_uncertain": False,
        "annualized_return_percent": 12.0, "win_rate_percent": 75.0,
        "mean_score_q": 68.0}


class SameWindowPromotionTests(unittest.TestCase):
    def test_reject_different_windows(self):
        self.assertEqual(decide_generation_promotion(BASE, BASE,
                         same_validation_window=False)["status"], "WAIT")

    def test_accept_increased_drawdown_inside_best_tier(self):
        new = dict(BASE, return_percent=10.0, drawdown_percent=3.0, annualized_return_percent=14.0)
        self.assertEqual(decide_generation_promotion(BASE, new,
                         same_validation_window=True)["status"], "RESEARCH_CANDIDATE")

    def test_reject_insufficient_trades(self):
        new = dict(BASE, return_percent=8.0, closed_trades=2)
        self.assertEqual(decide_generation_promotion(BASE, new,
                         same_validation_window=True)["status"], "REJECT")

    def test_reject_challenger_below_approved_metrics(self):
        for key, value in (("annualized_return_percent", 9.9),
                           ("win_rate_percent", 69.9),
                           ("mean_score_q", 64.9),
                           ("annualized_return_percent", None)):
            with self.subTest(metric=key, value=value):
                new = dict(BASE, return_percent=8.0, drawdown_percent=1.0)
                new[key] = value
                self.assertEqual(decide_generation_promotion(
                    BASE, new, same_validation_window=True)["reason"],
                    "challenger_not_eligible")

    def test_priority_annualized_over_win_rate(self):
        new = dict(BASE, annualized_return_percent=13.0,
                   win_rate_percent=71.0, mean_score_q=65.0)
        self.assertEqual(decide_generation_promotion(
            BASE, new, same_validation_window=True)["status"], "RESEARCH_CANDIDATE")

    def test_no_promotion_when_annualized_worsens(self):
        new = dict(BASE, annualized_return_percent=11.0,
                   win_rate_percent=95.0, mean_score_q=90.0)
        self.assertEqual(decide_generation_promotion(
            BASE, new, same_validation_window=True)["reason"], "no_priority_order_improvement")

    def test_win_rate_then_score_tie_breakers(self):
        higher_win = dict(BASE, win_rate_percent=76.0)
        higher_score = dict(BASE, mean_score_q=69.0)
        for candidate in (higher_win, higher_score):
            self.assertEqual(decide_generation_promotion(
                BASE, candidate, same_validation_window=True)["status"], "RESEARCH_CANDIDATE")

    def test_accept_research_only(self):
        new = dict(BASE, return_percent=5.0, drawdown_percent=1.5, annualized_return_percent=13.0)
        result = decide_generation_promotion(BASE, new, same_validation_window=True)
        self.assertEqual(result["status"], "RESEARCH_CANDIDATE")
        self.assertFalse(result["live_promoted"])
        self.assertFalse(result["paper_promoted"])


if __name__ == "__main__":
    unittest.main()
