import unittest
from p3.model_version_comparison import compare_versions

BASE = dict(symbol="BTCUSDT", strategy="INTRADAY", timeframe="15m",
            lookback_years=1, validation_window="2026-01/2026-03",
            evaluation_version="v1", dataset_version="native-v1",
            feature_version="v1", fee_version="v1", code_version="git:abc", validation_eligible=True, validation_score=2.0)

class ComparisonTests(unittest.TestCase):
    def test_reject_ineligible(self):
        self.assertEqual(compare_versions(None, {**BASE, "validation_eligible": False})["decision"], "REJECT")
    def test_no_champion_requires_review(self):
        self.assertEqual(compare_versions(None, BASE)["decision"], "REVIEW")
    def test_keep_better_champion(self):
        self.assertEqual(compare_versions(BASE, {**BASE, "validation_score": 1.0})["decision"], "KEEP_CHAMPION")
    def test_improvement_never_auto_promotes(self):
        self.assertEqual(compare_versions(BASE, {**BASE, "validation_score": 3.0})["decision"], "REVIEW")
    def test_mismatched_window(self):
        self.assertEqual(compare_versions(BASE, {**BASE, "validation_window": "other"})["decision"], "INCOMPARABLE")
    def test_missing_context(self):
        self.assertEqual(compare_versions(BASE, {**BASE, "validation_window": None})["decision"], "INCOMPARABLE")
    def test_nan_rejected(self):
        self.assertEqual(compare_versions(None, {**BASE, "validation_score": float("nan")})["decision"], "REJECT")
    def test_dataset_mismatch(self):
        self.assertEqual(compare_versions(BASE, {**BASE, "dataset_version": "v2"})["decision"], "INCOMPARABLE")
    def test_code_version_mismatch(self):
        self.assertEqual(compare_versions(BASE, {**BASE, "code_version": "git:other"})["decision"], "INCOMPARABLE")
    def test_holdout_does_not_affect_selection(self):
        a = compare_versions({**BASE, "holdout_return_percent": 100}, {**BASE, "validation_score": 3, "holdout_return_percent": -99})
        self.assertEqual(a["decision"], "REVIEW")

if __name__ == "__main__":
    unittest.main()
