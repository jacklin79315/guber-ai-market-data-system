"""Research feedback must change candidate selection using trading outcomes."""
import unittest
from unittest.mock import patch
from p3.walk_forward_feedback import (
    research_rank, select_research_candidate, run_research_iterations)


def metrics(annualized, *, trades=8, dd=2):
    return {"annualized_return_percent": annualized,
            "win_rate_percent": 75.0, "mean_score_q": 70.0,
            "normal_closed_trades": trades,
            "max_close_to_close_drawdown_percent": dd,
            "entry_bars_with_unresolved_exit": 0,
            "ambiguous_exit_count": 0}


class ResearchFeedbackTests(unittest.TestCase):
    def test_unqualified_feedback_not_used_for_exploitation(self):
        self.assertIsNone(research_rank(metrics(100, trades=0)))
        self.assertIsNone(research_rank(metrics(100, dd=41)))

    def test_best_trade_result_changes_next_candidate(self):
        grid = ({"max_iter": 80, "learning_rate": 0.05},
                {"max_iter": 160, "learning_rate": 0.05},
                {"max_iter": 80, "learning_rate": 0.10},
                {"max_iter": 160, "learning_rate": 0.10})
        history = [
            {"params": grid[0], "metrics": metrics(-20)},
            {"params": grid[1], "metrics": metrics(25)}]
        self.assertEqual(select_research_candidate(history, grid), grid[3])

    def test_loop_never_promotes_research_results(self):
        with patch("p3.walk_forward_feedback.replay_walk_forward_research",
                   side_effect=[
                       {"research_trading_metrics": metrics(1),
                        "research_trades": 8, "training_checkpoints": []},
                       {"research_trading_metrics": metrics(2),
                        "research_trades": 8, "training_checkpoints": []}]):
            result = run_research_iterations([], [], "INTRADAY",
                                             (100, 200), iterations=2, symbol="BTCUSDT")
        self.assertEqual(len(result["iterations"]), 2)
        self.assertTrue(result["feedback_used_for_candidate_selection"])
        self.assertFalse(result["independent_validation_performed"])
        self.assertFalse(result["eligible_for_promotion"])


if __name__ == "__main__":
    unittest.main()
