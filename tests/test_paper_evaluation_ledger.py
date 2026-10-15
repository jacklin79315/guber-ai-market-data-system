import unittest
from p3.paper_evaluation_ledger import save_paper_evaluation, compare_paper_evaluations
from p3.paper_outcome_memory import PLAN_VERSION, DATA_VERSION


class EvaluationLedgerTests(unittest.TestCase):
    def test_comparison_flags_small_sample_and_version_mismatch(self):
        def db(*args, **kwargs):
            return [{"run_key": "x", "plan_version": PLAN_VERSION,
                     "data_version": DATA_VERSION,
                     "model_mae_r": 0.5, "baseline_mae_r": 1.0,
                     "selected_trades": 2,
                     "evaluation_start_ms": 100, "evaluation_end_ms": 200},
                    {"run_key": "y", "plan_version": "old",
                     "data_version": DATA_VERSION,
                     "model_mae_r": 2.0, "baseline_mae_r": 1.0,
                     "selected_trades": 100,
                     "evaluation_start_ms": 150, "evaluation_end_ms": 250}]
        rows = compare_paper_evaluations(db, symbol="BTCUSDT",
                                         strategy="INTRADAY")
        self.assertTrue(rows[0]["mae_beats_baseline"])
        self.assertFalse(rows[0]["trading_evidence_sufficient"])
        self.assertFalse(rows[1]["version_comparable"])
        self.assertTrue(rows[0]["independent_evaluation_window"])
        self.assertFalse(rows[1]["independent_evaluation_window"])
        self.assertFalse(any(x["eligible_for_promotion"] for x in rows))

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
