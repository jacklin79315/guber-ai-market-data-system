import unittest
from p3.model_review_registry import record_model_review

def row(key, score=2.0, accepted=True):
    return {"run_key": key, "symbol": "BTCUSDT", "strategy": "INTRADAY",
            "timeframe": "15m", "lookback_years": 2,
            "validation_score": score, "validation_eligible": True,
            "report": {"qualification": {"holdout_accepted": accepted, "paper_eligible": False},
                       "comparison_context": {"validation_window": [1, 2],
                           "evaluation_version": "v1", "dataset_version": "d1",
                           "feature_version": "f1", "fee_version": "fee1"}}}

class ReviewRegistryTests(unittest.TestCase):
    def test_write_review_without_promotion(self):
        writes = []
        def db(method, table, params, payload=None, extra=None):
            if method == "GET":
                return [row("c", 3) if params["run_key"] == "eq.c" else row("a")]
            writes.append((table, payload, extra))
            return []
        result = record_model_review(db, "c", "a")
        self.assertEqual(result["decision"], "REVIEW")
        self.assertFalse(result["promotion_authorized"])
        self.assertEqual(writes[0][0], "ai_model_reviews")
        self.assertIn("ignore-duplicates", writes[0][2]["Prefer"])
    def test_reject_failed_holdout(self):
        def db(method, table, params, payload=None, extra=None):
            return [row("c", accepted=False)] if method == "GET" else []
        self.assertEqual(record_model_review(db, "c")["decision"], "REJECT")
    def test_missing_challenger_fails_closed(self):
        with self.assertRaises(ValueError):
            record_model_review(lambda *args, **kwargs: [], "missing")
    def test_same_run_fails_closed(self):
        with self.assertRaises(ValueError):
            record_model_review(lambda *args, **kwargs: [], "a", "a")

if __name__ == "__main__":
    unittest.main()
