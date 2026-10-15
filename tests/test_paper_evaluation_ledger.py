import unittest
from p3.paper_evaluation_ledger import save_paper_evaluation


class EvaluationLedgerTests(unittest.TestCase):
    def test_deterministic_key_and_research_only(self):
        calls = []
        def db(*args, **kwargs):
            calls.append((args, kwargs))
        kwargs = dict(symbol="BTCUSDT", strategy="INTRADAY",
            timeframe="15m", evaluation_start_ms=100,
            evaluation_end_ms=200,
            learning={"model": "ridge_baseline_v1",
                      "available_training_observation_count": 50,
                      "prediction_count": 8,
                      "mean_absolute_error_r": 0.2,
                      "baseline_mean_absolute_error_r": 0.3,
                      "predictions": []},
            decisions={"realized_selected_count": 2,
                       "realized_total_net_r": -0.1, "decisions": []})
        first = save_paper_evaluation(db, **kwargs)
        second = save_paper_evaluation(db, **kwargs)
        self.assertEqual(first, second)
        self.assertEqual(calls[0][1]["params"]["on_conflict"], "run_key")
        self.assertFalse(calls[0][1]["payload"][0]["report"]["auto_trade_enabled"])
        self.assertEqual(calls[0][1]["payload"][0]["selected_trades"], 2)


if __name__ == "__main__":
    unittest.main()
