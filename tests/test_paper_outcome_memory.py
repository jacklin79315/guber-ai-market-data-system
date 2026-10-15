import unittest
from p3.paper_outcome_memory import save_settled_outcomes, load_settled_outcomes


class PaperMemoryTests(unittest.TestCase):
    def test_settled_records_persist_with_stable_version(self):
        calls = []
        def db(*args, **kwargs):
            calls.append((args, kwargs))
        n = save_settled_outcomes(db, symbol="BTCUSDT", strategy="INTRADAY",
            timeframe="15m", asof_ms=1000, records=[
                {"signal_time_ms": 100, "label_end_ms": 200,
                 "direction": "LONG", "net_r": -1.2,
                 "signal_features": {"rsi": 40}}])
        self.assertEqual(n, 1)
        self.assertEqual(calls[0][0][:2], ("POST", "ai_paper_outcomes"))
        self.assertIn("ignore-duplicates", calls[0][1]["extra"]["Prefer"])
        self.assertEqual(calls[0][1]["payload"][0]["direction"], "LONG")

    def test_reader_filters_settled_versioned_rows(self):
        calls = []
        def db(*args, **kwargs):
            calls.append((args, kwargs))
            return []
        load_settled_outcomes(db, symbol="BTCUSDT", strategy="INTRADAY",
                              timeframe="15m", asof_ms=500)
        params = calls[0][1]["params"]
        self.assertEqual(params["label_end_ms"], "lt.500")
        self.assertIn("model_plan_version", params)
        self.assertIn("source_data_version", params)

    def test_future_or_duplicate_labels_rejected_without_writes(self):
        calls = []
        def db(*args, **kwargs):
            calls.append(args)
        row = {"signal_time_ms": 100, "label_end_ms": 300,
               "direction": "SHORT", "net_r": 0.5, "signal_features": {}}
        for rows, asof in [([row], 200), ([row, row], 500)]:
            with self.assertRaises(ValueError):
                save_settled_outcomes(db, symbol="BTCUSDT", strategy="INTRADAY",
                    timeframe="15m", asof_ms=asof, records=rows)
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
