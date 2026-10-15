import unittest
from p3.champion_challenger import review_challenger

BASE = dict(symbol="BTCUSDT", strategy="INTRADAY", timeframe="15m",
            lookback_years=2, validation_window=[1, 2], evaluation_version="v1",
            dataset_version="native-v1", feature_version="v1", fee_version="v1", code_version="git:abc",
            validation_eligible=True, validation_score=2.0,
            qualification={"holdout_accepted": True, "paper_eligible": False})

class ChampionChallengerTests(unittest.TestCase):
    def test_reject_failed_holdout(self):
        result = review_challenger(None, {**BASE, "qualification": {"holdout_accepted": False}})
        self.assertEqual(result["decision"], "REJECT")
    def test_no_champion_requires_review(self):
        result = review_challenger(None, BASE)
        self.assertEqual(result["decision"], "REVIEW")
        self.assertFalse(result["promotion_authorized"])
    def test_better_validation_never_auto_promotes(self):
        result = review_challenger(BASE, {**BASE, "validation_score": 3.0})
        self.assertEqual(result["decision"], "REVIEW")
        self.assertFalse(result["promotion_authorized"])
    def test_holdout_cannot_override_worse_validation(self):
        result = review_challenger(BASE, {**BASE, "validation_score": 1.0,
                                          "holdout_return_percent": 999.0})
        self.assertEqual(result["decision"], "KEEP_CHAMPION")

if __name__ == "__main__":
    unittest.main()
