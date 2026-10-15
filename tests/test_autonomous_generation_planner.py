import unittest
from p3.autonomous_generation_planner import plan_next_generation


class AutonomousPlannerTests(unittest.TestCase):
    def setUp(self):
        self.parent = [{"trial_index": i, "status": "COMPLETE",
                        "validation_eligible": i == 1,
                        "validation_start_ms": 1000,
                        "validation_end_ms": 2000} for i in range(1, 26)]
        self.kw = dict(parent_run_id="parent-1", parent_generation=1,
                       parent_trials=self.parent, previous_window=[1000, 2000],
                       current_window=[3000, 4000], existing_windows=[])

    def test_ready(self):
        r = plan_next_generation(**self.kw)
        self.assertEqual(r["status"], "READY")
        self.assertEqual(r["generation"], 2)
        self.assertTrue(r["requires_atomic_claim"])

    def test_generation_100_ready_with_new_window(self):
        self.kw["parent_generation"] = 99
        self.assertEqual(plan_next_generation(**self.kw)["generation"], 100)

    def test_generation_101_allowed(self):
        self.kw["parent_generation"] = 100
        self.assertEqual(plan_next_generation(**self.kw)["generation"], 101)

    def test_duplicate_window(self):
        self.kw["existing_windows"] = [[3000, 4000]]
        self.assertEqual(plan_next_generation(**self.kw)["status"], "WAIT")

    def test_missing_parent_lineage(self):
        self.parent[0]["validation_end_ms"] = None
        self.assertEqual(plan_next_generation(**self.kw)["reason"], "parent_window_unverified")

    def test_missing_current_window(self):
        self.kw["current_window"] = None
        self.assertEqual(plan_next_generation(**self.kw)["status"], "WAIT")

    def test_partial_parent(self):
        self.kw["parent_trials"] = self.parent[:-1]
        self.assertEqual(plan_next_generation(**self.kw)["reason"], "parent_trial_count_incomplete")


if __name__ == "__main__":
    unittest.main()
