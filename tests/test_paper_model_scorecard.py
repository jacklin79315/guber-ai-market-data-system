import unittest
from p3.paper_model_scorecard import score_paper_model


class PaperModelScorecardTests(unittest.TestCase):
    def test_insufficient_trades_are_unscored(self):
        result = score_paper_model(trades=2, total_net_r=10,
                                   max_drawdown_r=0, profit_factor=10,
                                   monthly_net_r=[1, 1, 1])
        self.assertEqual(result["status"], "INSUFFICIENT_EVIDENCE")
        self.assertIsNone(result["total_score"])
        self.assertFalse(result["eligible_for_promotion"])

    def test_no_annualization_or_promotion_even_for_good_sample(self):
        result = score_paper_model(trades=40, total_net_r=12,
                                   max_drawdown_r=2, profit_factor=2.5,
                                   monthly_net_r=[2, -1, 3, 4])
        self.assertEqual(result["status"], "PARTIAL_SCORE")
        self.assertIsNone(result["annualized_return"])
        self.assertIsNone(result["total_score"])
        self.assertAlmostEqual(result["average_net_r"], .3)
        self.assertFalse(result["eligible_for_promotion"])

    def test_invalid_inputs_rejected(self):
        with self.assertRaises(ValueError):
            score_paper_model(trades=40, total_net_r=float("nan"),
                              max_drawdown_r=0, profit_factor=1)


if __name__ == "__main__":
    unittest.main()
