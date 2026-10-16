import unittest
from p3.autonomous_experiment_plan import propose_experiment, compare_research_trials, compare_iteration_records, research_data_fingerprint


def metrics(annualized, dd=12):
    return {"annualized_return_percent": annualized,
            "win_rate_percent": 70, "mean_score_q": 65,
            "max_close_to_close_drawdown_percent": dd,
            "normal_closed_trades": 12, "ambiguous_exit_count": 0}


class AutonomousExperimentPlanTests(unittest.TestCase):
    def test_proposal_requires_approval_and_never_generates_params(self):
        result = propose_experiment({
            "status": "TESTABLE_HYPOTHESIS_ONLY",
            "source_trial_index": 3,
            "hypothesis": "REVIEW_DIRECTION_OUTCOMES_LONG",
            "evidence": {"closed": 20, "win_rate_percent": 30}})
        self.assertEqual(result["target_layer"], "DIRECTION")
        self.assertTrue(result["requires_approval"])
        self.assertIsNone(result["candidate_params"])
        self.assertFalse(result["eligible_for_promotion"])

    def test_missing_hypothesis_blocks_experiment(self):
        result = propose_experiment({"status": "NO_ELIGIBLE_FEEDBACK"})
        self.assertEqual(result["status"], "BLOCKED_NO_TESTABLE_HYPOTHESIS")
        self.assertIsNone(result["candidate_params"])

    def test_research_comparison_does_not_promote(self):
        result = compare_research_trials(metrics(-12), metrics(-5))
        self.assertTrue(result["candidate_better_in_research"])
        self.assertEqual(result["metric_deltas_candidate_minus_baseline"]
                         ["annualized_return_percent"], 7)
        self.assertFalse(result["independent_validation_performed"])
        self.assertFalse(result["eligible_for_promotion"])

    def test_comparison_requires_matching_context(self):
        base = {"strategy": "INTRADAY", "research_window": [100, 200],
                "symbol": "BTCUSDT", "fee_rate": 0.001,
                "slippage_rate": 0.0005, "data_fingerprint": "abc",
                "metrics": metrics(-12)}
        candidate = dict(base, metrics=metrics(-5))
        self.assertTrue(compare_iteration_records(base, candidate)
                        ["candidate_better_in_research"])
        self.assertEqual(compare_iteration_records(
            base, dict(candidate, research_window=[110, 200]))
            ["status"], "BLOCKED_MISMATCHED_COMPARISON_CONTEXT")
        self.assertEqual(compare_iteration_records(
            base, {k: v for k, v in candidate.items()
                   if k != "data_fingerprint"})
            ["status"], "BLOCKED_MISSING_COMPARISON_CONTEXT")

    def test_research_fingerprint_ignores_holdout_and_row_order(self):
        candles = [{"close_time": 120, "close": 2},
                   {"close_time": 130, "close": 3},
                   {"close_time": 210, "close": 4}]
        features = [{"close_time": 120, "rsi": 50},
                    {"close_time": 130, "rsi": 55},
                    {"close_time": 210, "rsi": 60}]
        first = research_data_fingerprint(candles, features, (100, 200))
        self.assertEqual(first, research_data_fingerprint(
            list(reversed(candles)), list(reversed(features)), (100, 200)))
        self.assertEqual(first, research_data_fingerprint(
            candles[:-1] + [{"close_time": 210, "close": 999}],
            features, (100, 200)))
        changed = [dict(features[0], rsi=40)] + features[1:]
        self.assertNotEqual(first, research_data_fingerprint(
            candles, changed, (100, 200)))
        with self.assertRaises(ValueError):
            research_data_fingerprint(candles + [candles[0]], features,
                                      (100, 200))

    def test_high_drawdown_is_not_a_valid_candidate(self):
        result = compare_research_trials(metrics(-12), metrics(40))
        self.assertEqual(result["status"], "NOT_COMPARABLE_UNDER_FEEDBACK_RULES")
        self.assertIsNone(result["candidate_better_in_research"])


if __name__ == "__main__":
    unittest.main()
