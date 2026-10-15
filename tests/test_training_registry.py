import os
import unittest
from unittest.mock import patch
from p3.training_registry import record_training_reports


def report():
    return {
        "timeframe": "15m",
        "validation_window": [100, 200],
        "validation_selection": {
            "selected_threshold": 0.6,
            "candidates": [{"threshold": 0.6, "return_percent": 5.0,
                            "drawdown_percent": 2.0, "closed_trades": 12}],
        },
        "qualification": {"validation_eligible": True, "paper_eligible": False},
        "provenance": {"dataset_version": "sha256:data", "feature_version": "sha256:features",
                       "fee_version": "sha256:fee", "code_version": "git:" + "a" * 40},
        "final_equity": 10100,
        "max_close_to_close_drawdown_percent": 3.0,
        "closed_trades": 8,
        "execution_path_uncertain": False,
    }


class TrainingRegistryTests(unittest.TestCase):
    def test_persists_full_comparison_context(self):
        captured = []
        def db(method, table, params, payload, extra):
            captured.extend(payload)
            return []
        with patch.dict(os.environ, {"GITHUB_RUN_ID": "123"}):
            result = record_training_reports(db, "BTCUSDT", 2, {"INTRADAY": report()})
        self.assertTrue(result["recorded"])
        self.assertEqual(len(captured), 1)
        row = captured[0]
        self.assertEqual(row["validation_score"], 3.0)
        self.assertFalse(row["paper_eligible"])
        self.assertEqual(row["report"]["comparison_context"]["code_version"], "git:" + "a" * 40)
        self.assertEqual(row["report"]["comparison_context"]["feature_version"], "sha256:features")

    def test_missing_commit_fails_closed_for_comparison(self):
        captured = []
        def db(method, table, params, payload, extra):
            captured.extend(payload)
            return []
        incomplete = report()
        incomplete["provenance"]["code_version"] = None
        with patch.dict(os.environ, {"GITHUB_RUN_ID": "123"}):
            record_training_reports(db, "BTCUSDT", 2, {"INTRADAY": incomplete})
        context = captured[0]["report"]["comparison_context"]
        self.assertIsNone(context["code_version"])
        self.assertIsNone(context["feature_version"])

    def test_no_run_id_does_not_write(self):
        def db(*args, **kwargs):
            self.fail("must not write without run ID")
        with patch.dict(os.environ, {"GITHUB_RUN_ID": ""}):
            result = record_training_reports(db, "BTCUSDT", 2, {"INTRADAY": report()})
        self.assertFalse(result["recorded"])


if __name__ == "__main__":
    unittest.main()
