"""Research feedback must learn from losses without approving risky models."""
import unittest
from unittest.mock import patch
from p3.walk_forward_feedback import (
    feedback_rank, research_rank, select_research_candidate,
    run_research_iterations, diagnose_feedback_hypothesis)


def metrics(annualized, *, trades=8, dd=2):
    return {"annualized_return_percent": annualized,
            "win_rate_percent": 75.0, "mean_score_q": 70.0,
            "normal_closed_trades": trades,
            "max_close_to_close_drawdown_percent": dd,
            "entry_bars_with_unresolved_exit": 0,
            "ambiguous_exit_count": 0}


class ResearchFeedbackTests(unittest.TestCase):
    def test_risky_loss_guides_feedback_but_is_not_qualified(self):
        self.assertIsNone(research_rank(metrics(-20, dd=41)))
        self.assertIsNone(feedback_rank(metrics(-20, dd=41)))
        self.assertIsNone(feedback_rank(metrics(100, trades=0)))

    def test_unresolved_entry_bars_are_diagnostics_not_invalid_trades(self):
        row = metrics(-22, dd=55)
        row["entry_bars_with_unresolved_exit"] = 27
        self.assertIsNone(feedback_rank(row))
        self.assertIsNone(research_rank(row))

    def test_ambiguous_exits_remain_disqualified_for_feedback(self):
        row = metrics(-22, dd=20)
        row["ambiguous_exit_count"] = 1
        self.assertIsNone(feedback_rank(row))

    def test_best_trade_result_changes_next_candidate(self):
        grid = ({"max_iter": 80, "learning_rate": 0.05},
                {"max_iter": 160, "learning_rate": 0.05},
                {"max_iter": 80, "learning_rate": 0.10},
                {"max_iter": 160, "learning_rate": 0.10})
        history = [{"params": grid[0], "metrics": metrics(-20)},
                   {"params": grid[1], "metrics": metrics(25)}]
        self.assertEqual(select_research_candidate(history, grid), grid[3])

    def test_high_drawdown_does_not_block_learning(self):
        grid = ({"max_iter": 80, "learning_rate": 0.05},
                {"max_iter": 160, "learning_rate": 0.05},
                {"max_iter": 80, "learning_rate": 0.10},
                {"max_iter": 160, "learning_rate": 0.10})
        history = [{"params": grid[0], "metrics": metrics(-25, dd=60)},
                   {"params": grid[1], "metrics": metrics(-15, dd=45)}]
        self.assertEqual(select_research_candidate(history, grid), grid[2])

    def test_drawdown_risk_boundaries(self):
        self.assertEqual(feedback_rank(metrics(20, dd=2)), feedback_rank(metrics(20, dd=8)))
        self.assertIsNotNone(feedback_rank(metrics(20, dd=35)))
        self.assertIsNone(feedback_rank(metrics(20, dd=35.01)))
        self.assertIsNone(feedback_rank(metrics(20, dd=40)))
        self.assertIsNone(feedback_rank(metrics(20, dd=40.01)))

    def test_hypothesis_uses_only_eligible_trade_evidence(self):
        blocked = {"trial_index": 1, "params": {}, "metrics": metrics(100, dd=41),
                   "eligible_trade_diagnosis": {"by_direction": {
                       "LONG": {"closed": 20, "win_rate_percent": 0, "net_pnl": -500}}}}
        good = {"trial_index": 2, "params": {}, "metrics": metrics(-2, dd=20),
                "eligible_trade_diagnosis": {"by_direction": {
                    "SHORT": {"closed": 8, "win_rate_percent": 25, "net_pnl": -30},
                    "LONG": {"closed": 3, "win_rate_percent": 0, "net_pnl": -40}}}}
        result = diagnose_feedback_hypothesis([blocked, good])
        self.assertEqual(result["source_trial_index"], 2)
        self.assertEqual(result["hypothesis"], "REVIEW_DIRECTION_OUTCOMES_SHORT")
        self.assertEqual(result["evidence"]["closed"], 8)
        self.assertEqual(diagnose_feedback_hypothesis([blocked])["status"],
                         "NO_ELIGIBLE_FEEDBACK")

    def test_hypothesis_requires_minimum_direction_sample(self):
        history = [{"trial_index": 1, "metrics": metrics(1, dd=10),
                    "eligible_trade_diagnosis": {"by_direction": {
                        "LONG": {"closed": 2, "win_rate_percent": 0}}}}]
        self.assertEqual(diagnose_feedback_hypothesis(history)["status"],
                         "INSUFFICIENT_TRADE_EVIDENCE")

    def test_loop_never_promotes_research_results(self):
        with patch("p3.walk_forward_feedback.replay_walk_forward_research",
                   side_effect=[
                       {"research_trading_metrics": metrics(-20, dd=50),
                        "research_trades": 8, "training_checkpoints": []},
                       {"research_trading_metrics": metrics(-10, dd=42),
                        "research_trades": 8, "training_checkpoints": []}]):
            result = run_research_iterations([], [], "INTRADAY",
                                             (100, 200), iterations=2, symbol="BTCUSDT")
        self.assertFalse(result["feedback_used_for_candidate_selection"])
        self.assertIsNone(result["best_research_trial_index"])
        self.assertIsNone(result["best_observed_trial_index"])
        self.assertFalse(result["independent_validation_performed"])
        self.assertFalse(result["eligible_for_promotion"])


if __name__ == "__main__":
    unittest.main()
