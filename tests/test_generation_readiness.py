import unittest
from unittest.mock import patch
from p3.generation_readiness import generation_readiness

DEFAULT = dict(latest_run_complete=True, current_window=[100, 200],
               previous_window=[50, 150], parent_eligible=True,
               already_evaluated=False)


class GenerationReadinessTests(unittest.TestCase):
    def test_ready_with_fresh_completed_window(self):
        self.assertEqual(generation_readiness(**DEFAULT)["status"], "READY")

    def test_prevent_duplicate(self):
        self.assertEqual(generation_readiness(**dict(DEFAULT, already_evaluated=True))["status"], "WAIT")

    def test_prevent_stale(self):
        self.assertEqual(generation_readiness(**dict(DEFAULT, current_window=[50, 150]))["status"], "WAIT")

    def test_prevent_incomplete_parent(self):
        self.assertEqual(generation_readiness(**dict(DEFAULT, latest_run_complete=False))["status"], "WAIT")

    def test_prevent_future_data(self):
        self.assertEqual(generation_readiness(**dict(DEFAULT, current_window=[100, 9999999999999]))["status"], "WAIT")

    def test_generation_100_allowed(self):
        self.assertEqual(generation_readiness(**dict(DEFAULT, next_generation=100))["status"], "READY")

    def test_explicit_run_limit_still_works(self):
        result = generation_readiness(**dict(DEFAULT, next_generation=101), max_generations=100)
        self.assertEqual(result["reason"], "generation_limit")

    def test_generation_101_allowed(self):
        self.assertEqual(generation_readiness(**dict(DEFAULT, next_generation=101))["status"], "READY")


if __name__ == "__main__":
    unittest.main()
