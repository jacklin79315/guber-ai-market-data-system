"""Four-strategy runner orchestration without database writes."""
import unittest
from unittest.mock import patch
from p3.walk_forward_runner import run_four_strategy_research


class RunnerTests(unittest.TestCase):
    def test_rejects_future_research_before_loading_data(self):
        with patch("p3.walk_forward_runner.load_fee_rate") as fee:
            with self.assertRaisesRegex(ValueError, "fully closed"):
                run_four_strategy_research(
                    lambda *a, **kw: None, symbol="BTCUSDT",
                    holdout_start_ms=4102444800000)
        fee.assert_not_called()

    def test_four_strategies_and_explicit_holdout(self):
        with patch("p3.walk_forward_runner.load_fee_rate", return_value=0.001), \
             patch("p3.walk_forward_runner.load_native_candles",
                   return_value=[{"close_time": 1}]) as candles, \
             patch("p3.walk_forward_runner.load_native_features",
                   return_value=[{"close_time": 1}]) as features, \
             patch("p3.walk_forward_runner.run_research_iterations",
                   return_value={"iterations": []}) as run:
            result = run_four_strategy_research(
                lambda *a, **kw: None, symbol="BTCUSDT",
                holdout_start_ms=1790812800000, iterations=2)
        self.assertEqual(run.call_count, 4)
        self.assertEqual(candles.call_count, 4)
        self.assertEqual(features.call_count, 4)
        self.assertEqual(set(result["strategies"]), {
            "INTRADAY", "ONE_TO_THREE_DAYS", "ONE_WEEK",
            "FIFTEEN_TO_THIRTY_DAYS"})
        self.assertTrue(all(c.kwargs["symbol"] == "BTCUSDT"
                            for c in run.call_args_list))
        self.assertFalse(result["eligible_for_promotion"])


if __name__ == "__main__":
    unittest.main()
