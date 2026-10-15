import unittest
from unittest.mock import patch
from p3.research_job_guard import execute_with_lease


class ResearchJobGuardTests(unittest.TestCase):
    @patch("p3.research_job_guard.research_window", return_value=[100, 200])
    def test_refuses_duplicate_claim(self, _window):
        calls = []
        def db(method, path, **kwargs):
            calls.append(path)
            return False
        def runner(*args, **kwargs):
            self.fail("runner must not execute without a lease")
        result = execute_with_lease(db, symbol="BTCUSDT", strategy="INTRADAY",
                                    years=3, runner=runner)
        self.assertEqual(result["status"], "WAIT")
        self.assertEqual(calls, ["rpc/claim_ai_research_job"])

    @patch("p3.research_job_guard.research_window", return_value=[100, 200])
    def test_success_releases_lease(self, _window):
        statuses = []
        def db(method, path, **kwargs):
            if path.endswith("finish_ai_research_job"):
                statuses.append(kwargs["payload"]["p_status"])
            return True
        result = execute_with_lease(db, symbol="BTCUSDT", strategy="INTRADAY",
                                    years=3, runner=lambda *a, **kw: {"status": "BATCH_COMPLETE", "eligible_trials": 1})
        self.assertEqual(result["status"], "BATCH_COMPLETE")
        self.assertEqual(statuses, ["SUCCEEDED"])

    @patch("p3.research_job_guard.research_window", return_value=[100, 200])
    def test_no_eligible_candidate_fails_iteration(self, _window):
        statuses = []
        def db(method, path, **kwargs):
            if path.endswith("finish_ai_research_job"):
                statuses.append(kwargs["payload"]["p_status"])
            return True
        with self.assertRaisesRegex(RuntimeError, "no eligible training candidate"):
            execute_with_lease(db, symbol="BTCUSDT", strategy="INTRADAY", years=3,
                               runner=lambda *a, **kw: {"status": "BATCH_COMPLETE", "eligible_trials": 0})
        self.assertEqual(statuses, ["FAILED"])

    @patch("p3.research_job_guard.research_window", return_value=[100, 200])
    def test_exception_marks_failed(self, _window):
        statuses = []
        def db(method, path, **kwargs):
            if path.endswith("finish_ai_research_job"):
                statuses.append(kwargs["payload"]["p_status"])
            return True
        def runner(*args, **kwargs):
            raise RuntimeError("training failed")
        with self.assertRaisesRegex(RuntimeError, "training failed"):
            execute_with_lease(db, symbol="BTCUSDT", strategy="INTRADAY",
                               years=3, runner=runner)
        self.assertEqual(statuses, ["FAILED"])


if __name__ == "__main__":
    unittest.main()
