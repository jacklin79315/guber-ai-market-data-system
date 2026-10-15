import unittest
from p3.generation_comparison import compare_generations


class GenerationComparisonTests(unittest.TestCase):
    def test_new_window_is_not_direct_evidence_of_improvement(self):
        a = [{"status": "COMPLETE", "validation_eligible": True, "validation_score": 1}]
        b = [{"status": "COMPLETE", "validation_eligible": True, "validation_score": 3}]
        report = compare_generations(a, b, parent_window=[1, 2], child_window=[2, 3])
        self.assertEqual(report["status"], "RESEARCH_COMPARISON_ONLY")
        self.assertFalse(report["is_apples_to_apples"])
        self.assertFalse(report["model_promoted"])

    def test_unchanged_window_is_wait(self):
        self.assertEqual(compare_generations([], [], parent_window=[1, 2],
                         child_window=[1, 2])["status"], "WAIT")

    def test_ineligible_generation_is_wait(self):
        a = [{"status": "COMPLETE", "validation_eligible": True, "validation_score": 1}]
        self.assertEqual(compare_generations(a, [], parent_window=[1, 2],
                         child_window=[2, 3])["status"], "WAIT")


if __name__ == "__main__":
    unittest.main()
