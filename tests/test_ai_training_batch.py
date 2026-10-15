import unittest
from p3.ai_training_batch import PARAMETERS, rank_validation_trials


class TrainingBatchTests(unittest.TestCase):
    def test_25_distinct_trials(self):
        self.assertEqual(len(PARAMETERS), 25)
        self.assertEqual(len({(p["max_iter"], p["learning_rate"])
                              for p in PARAMETERS}), 25)

    def test_rank_only_eligible_validation_trials(self):
        trials = [
            {"trial_index": 1, "validation_eligible": False, "validation_score": 999},
            {"trial_index": 2, "validation_eligible": True, "validation_score": 2},
            {"trial_index": 3, "validation_eligible": True, "validation_score": 3},
        ]
        self.assertEqual([r["trial_index"] for r in rank_validation_trials(trials)], [3, 2])

    def test_deterministic_tie_break(self):
        trials = [
            {"trial_index": 3, "validation_eligible": True, "validation_score": 2},
            {"trial_index": 1, "validation_eligible": True, "validation_score": 2},
        ]
        self.assertEqual(rank_validation_trials(trials)[0]["trial_index"], 1)


if __name__ == "__main__":
    unittest.main()
