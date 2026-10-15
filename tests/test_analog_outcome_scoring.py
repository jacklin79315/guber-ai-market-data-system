import unittest

from p3.analog_outcome_scoring import evaluate_analog_outcomes


class AnalogOutcomeScoringTests(unittest.TestCase):
    def test_wait_on_insufficient_samples_even_with_perfect_wins(self):
        neighbors = [{"timestamp_ms": i * 10, "label_end_ms": i * 10 + 5,
                      "distance": 0.1} for i in range(10)]
        outcomes = {x["timestamp_ms"]: {"label_end_ms": x["label_end_ms"],
                     "net_r": 2.0} for x in neighbors}
        result = evaluate_analog_outcomes(neighbors, outcomes)
        self.assertEqual(result["decision"], "WAIT")
        self.assertEqual(result["reason"], "insufficient_independent_samples")

    def test_high_win_rate_can_have_negative_expectancy(self):
        neighbors = [{"timestamp_ms": i * 10, "label_end_ms": i * 10 + 5,
                      "distance": 0.1} for i in range(40)]
        outcomes = {x["timestamp_ms"]: {"label_end_ms": x["label_end_ms"],
                     "net_r": 0.1 if i % 5 else -2.0}
                    for i, x in enumerate(neighbors)}
        result = evaluate_analog_outcomes(neighbors, outcomes)
        self.assertEqual(result["decision"], "WAIT")
        self.assertAlmostEqual(result["win_rate"], 0.8)
        self.assertLess(result["net_expectancy_r"], 0)

    def test_positive_expectancy_can_be_candidate(self):
        neighbors = [{"timestamp_ms": i * 10, "label_end_ms": i * 10 + 5,
                      "distance": 0.1} for i in range(40)]
        outcomes = {x["timestamp_ms"]: {"label_end_ms": x["label_end_ms"],
                     "net_r": 2.0 if i % 2 else 1.0}
                    for i, x in enumerate(neighbors)}
        self.assertEqual(evaluate_analog_outcomes(neighbors, outcomes)["decision"], "CANDIDATE")

    def test_overlapping_outcomes_not_double_counted(self):
        neighbors = [{"timestamp_ms": i, "label_end_ms": i + 5,
                      "distance": 0.1} for i in range(20)]
        outcomes = {x["timestamp_ms"]: {"label_end_ms": x["label_end_ms"],
                     "net_r": 2.0} for x in neighbors}
        result = evaluate_analog_outcomes(neighbors, outcomes, min_samples=5)
        self.assertEqual(result["sample_count"], 4)
        self.assertEqual(result["decision"], "WAIT")

    def test_mismatched_label_end_rejected(self):
        neighbors = [{"timestamp_ms": 1, "label_end_ms": 5, "distance": 0.1}]
        outcomes = {1: {"label_end_ms": 6, "net_r": 9.0}}
        self.assertEqual(evaluate_analog_outcomes(neighbors, outcomes)["sample_count"], 0)


if __name__ == "__main__":
    unittest.main()
