"""Regression tests for the approved portfolio drawdown risk tiers."""
import unittest
from p3.model_qualification import evaluate_model_gates
from p3.validation_selection import MAX_VALIDATION_DRAWDOWN_PERCENT
from p3.same_window_promotion import decide_generation_promotion


def metrics(drawdown):
    return dict(closed_trades=10, normal_closed_trades=10,
                backtest_end_settlement_count=0, backtest_end_settlement_percent=0,
                max_close_to_close_drawdown_percent=drawdown,
                final_mark_to_market_equity=12000,
                annualized_return_percent=25, win_rate_percent=80,
                mean_score_q=75, execution_path_uncertain=False)


class DrawdownTierPolicyTests(unittest.TestCase):
    def test_candidate_and_research_boundaries(self):
        self.assertEqual(MAX_VALIDATION_DRAWDOWN_PERCENT, 35)
        for drawdown, tier, accepted in ((0, 'BEST_0_TO_8', True),
                                         (2, 'BEST_0_TO_8', True),
                                         (8, 'BEST_0_TO_8', True),
                                         (20, 'CANDIDATE_8_TO_35', True),
                                         (35, 'CANDIDATE_8_TO_35', True),
                                         (35.01, 'RESEARCH_ONLY_35_TO_40', False),
                                         (40, 'RESEARCH_ONLY_35_TO_40', False),
                                         (40.01, 'ABSOLUTE_REJECT_OVER_40', False)):
            with self.subTest(drawdown=drawdown):
                result = evaluate_model_gates({'selected_threshold': 0.6}, metrics(drawdown))
                self.assertEqual(result['drawdown_risk_tier'], tier)
                self.assertEqual(result['holdout_accepted'], accepted)
                self.assertEqual(result['drawdown_absolute_reject'], drawdown > 40)
                self.assertEqual(result['drawdown_research_only'], 35 < drawdown <= 40)

    def test_promotion_rejects_research_only_challenger(self):
        champion = dict(return_percent=20, drawdown_percent=8, closed_trades=10,
                        execution_path_uncertain=False, annualized_return_percent=20,
                        win_rate_percent=75, mean_score_q=70)
        challenger = dict(champion, return_percent=50, annualized_return_percent=50,
                          drawdown_percent=37)
        decision = decide_generation_promotion(champion, challenger, same_validation_window=True)
        self.assertFalse(decision['research_promoted'])
        self.assertEqual(decision['reason'], 'challenger_not_eligible')


if __name__ == '__main__':
    unittest.main()
