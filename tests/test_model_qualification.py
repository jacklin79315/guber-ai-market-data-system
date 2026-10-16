import unittest
from p3.model_qualification import evaluate_model_gates

SEL = {"selected_threshold": 0.6}
MET = {"closed_trades": 8, "max_close_to_close_drawdown_percent": 4.0,
       "final_mark_to_market_equity": 11000.0, "execution_path_uncertain": False,
       "annualized_return_percent": 12.0, "win_rate_percent": 75.0,
       "mean_score_q": 68.0,
       "normal_closed_trades": 8, "backtest_end_settlement_count": 0,
       "backtest_end_settlement_percent": 0.0}

class QualificationTests(unittest.TestCase):
    def test_acceptance_not_activation(self):
        x = evaluate_model_gates(SEL, MET)
        self.assertTrue(x["validation_eligible"])
        self.assertTrue(x["holdout_accepted"])
        self.assertFalse(x["paper_eligible"])
        self.assertFalse(x["champion_eligible"])
    def test_validation_rejection(self):
        self.assertFalse(evaluate_model_gates({"selected_threshold": None}, MET)["holdout_accepted"])
    def test_insufficient_trades(self):
        self.assertFalse(evaluate_model_gates(SEL, {**MET, "closed_trades": 4})["holdout_accepted"])
    def test_excessive_drawdown(self):
        self.assertFalse(evaluate_model_gates(SEL, {**MET, "max_close_to_close_drawdown_percent": 9})["holdout_accepted"])
    def test_uncertain_execution(self):
        self.assertFalse(evaluate_model_gates(SEL, {**MET, "execution_path_uncertain": True})["holdout_accepted"])
    def test_performance_gates(self):
        for key, value in (("annualized_return_percent", 9.99),
                           ("win_rate_percent", 69.99),
                           ("mean_score_q", 64.99)):
            with self.subTest(metric=key):
                self.assertFalse(evaluate_model_gates(SEL, {**MET, key: value})["holdout_accepted"])
        for key in ("annualized_return_percent", "win_rate_percent", "mean_score_q"):
            with self.subTest(missing=key):
                missing = dict(MET)
                del missing[key]
                self.assertFalse(evaluate_model_gates(SEL, missing)["holdout_accepted"])

    def test_synthetic_settlement_requires_explicit_policy(self):
        metrics = {**MET, "normal_closed_trades": 6,
                   "backtest_end_settlement_count": 2,
                   "backtest_end_settlement_percent": 25.0}
        pending = evaluate_model_gates(SEL, metrics)
        self.assertFalse(pending["holdout_accepted"])
        self.assertEqual(pending["settlement_policy_status"], "WAIT_SETTLEMENT_RATIO_POLICY")
        self.assertTrue(evaluate_model_gates(
            SEL, metrics, max_end_settlement_percent=25)["holdout_accepted"])
        self.assertFalse(evaluate_model_gates(
            SEL, metrics, max_end_settlement_percent=20)["holdout_accepted"])

    def test_missing_or_inconsistent_settlement_audit_fails_closed(self):
        self.assertFalse(evaluate_model_gates(SEL, {
            **MET, "backtest_end_settlement_count": None})["holdout_accepted"])
        self.assertFalse(evaluate_model_gates(SEL, {
            **MET, "backtest_end_settlement_percent": 50})["holdout_accepted"])
        self.assertFalse(evaluate_model_gates(SEL, {
            **MET, "normal_closed_trades": 7})["holdout_accepted"])

    def test_missing_or_nan_metrics(self):
        self.assertFalse(evaluate_model_gates(SEL, {**MET, "final_mark_to_market_equity": float("nan")})["holdout_accepted"])
        self.assertFalse(evaluate_model_gates(SEL, {**MET, "closed_trades": None})["holdout_accepted"])

if __name__ == "__main__":
    unittest.main()
