import unittest
from p3.model_qualification import evaluate_model_gates

SEL = {"selected_threshold": 0.6}
MET = {"closed_trades": 8, "max_close_to_close_drawdown_percent": 4.0,
       "final_mark_to_market_equity": 11000.0, "execution_path_uncertain": False}

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
    def test_missing_or_nan_metrics(self):
        self.assertFalse(evaluate_model_gates(SEL, {**MET, "final_mark_to_market_equity": float("nan")})["holdout_accepted"])
        self.assertFalse(evaluate_model_gates(SEL, {**MET, "closed_trades": None})["holdout_accepted"])

if __name__ == "__main__":
    unittest.main()
