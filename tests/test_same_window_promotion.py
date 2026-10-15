import unittest
from p3.same_window_promotion import decide_generation_promotion

BASE = {"return_percent": 3.0, "drawdown_percent": 2.0,
        "closed_trades": 10, "execution_path_uncertain": False}


class SameWindowPromotionTests(unittest.TestCase):
    def test_reject_different_windows(self):
        self.assertEqual(decide_generation_promotion(BASE, BASE,
                         same_validation_window=False)["status"], "WAIT")

    def test_reject_increased_drawdown_even_with_higher_score(self):
        new = dict(BASE, return_percent=10.0, drawdown_percent=3.0)
        self.assertEqual(decide_generation_promotion(BASE, new,
                         same_validation_window=True)["reason"], "drawdown_worsened")

    def test_reject_insufficient_trades(self):
        new = dict(BASE, return_percent=8.0, closed_trades=2)
        self.assertEqual(decide_generation_promotion(BASE, new,
                         same_validation_window=True)["status"], "REJECT")

    def test_accept_research_only(self):
        new = dict(BASE, return_percent=5.0, drawdown_percent=1.5)
        result = decide_generation_promotion(BASE, new, same_validation_window=True)
        self.assertEqual(result["status"], "RESEARCH_CANDIDATE")
        self.assertFalse(result["live_promoted"])
        self.assertFalse(result["paper_promoted"])


if __name__ == "__main__":
    unittest.main()
