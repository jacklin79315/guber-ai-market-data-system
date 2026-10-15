import unittest
from p3.iterative_generation import propose_generation

PARENT = {"status": "COMPLETE", "validation_eligible": True,
          "validation_score": 2.0, "trial_index": 1,
          "params": {"max_iter": 120, "learning_rate": 0.05}}


class IterativeGenerationTests(unittest.TestCase):
    def test_wait_without_new_validation_window(self):
        result = propose_generation([PARENT], current_validation_window=[1, 2],
                                    previous_validation_window=[1, 2])
        self.assertEqual(result["status"], "WAIT")
        self.assertEqual(result["candidates"], [])

    def test_wait_without_eligible_parent(self):
        result = propose_generation([], current_validation_window=[2, 3],
                                    previous_validation_window=[1, 2])
        self.assertEqual(result["reason"], "no_eligible_parent")

    def test_propose_novel_bounded_candidates(self):
        result = propose_generation([PARENT], current_validation_window=[2, 3],
                                    previous_validation_window=[1, 2])
        self.assertEqual(result["status"], "READY")
        self.assertEqual(len(result["candidates"]), 25)
        self.assertNotIn(PARENT["params"], result["candidates"])
        self.assertEqual(len({(x["max_iter"], x["learning_rate"])
                              for x in result["candidates"]}), 25)
        self.assertFalse(result["auto_promote"])
        self.assertFalse(result["holdout_used_for_selection"])

    def test_deterministic(self):
        args = {"current_validation_window": [2, 3],
                "previous_validation_window": [1, 2]}
        self.assertEqual(propose_generation([PARENT], **args),
                         propose_generation([PARENT], **args))


if __name__ == "__main__":
    unittest.main()
