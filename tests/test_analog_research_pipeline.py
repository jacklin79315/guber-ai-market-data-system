import unittest

from p3.analog_research_pipeline import research_analog_plan


class AnalogResearchPipelineTests(unittest.TestCase):
    def test_end_to_end_positive_plan(self):
        candles = []
        history = []
        for i in range(40):
            start = i * 100
            history.append({"timestamp_ms": start + 9,
                            "label_end_ms": start + 19, "rsi": 30 + i % 2})
            candles.append({"open_time": start + 10, "close_time": start + 19,
                            "open": 100, "high": 104, "low": 99, "close": 103})
        result = research_analog_plan(
            {"rsi": 30}, history, candles, ["rsi"], asof_ms=5000,
            horizon_ms=30, direction="LONG", stop_pct=.02, target_pct=.03,
            max_holding_bars=1, k=40, min_samples=30)
        self.assertEqual(result["decision"], "CANDIDATE")
        self.assertEqual(result["sample_count"], 40)
        self.assertFalse(result["auto_trade_enabled"])

    def test_future_outcomes_are_not_used(self):
        history = [{"timestamp_ms": 9, "label_end_ms": 19, "rsi": 30}]
        candles = [{"open_time": 10, "close_time": 19,
                    "open": 100, "high": 104, "low": 99, "close": 103}]
        result = research_analog_plan(
            {"rsi": 30}, history, candles, ["rsi"], asof_ms=18,
            horizon_ms=30, direction="LONG", stop_pct=.02, target_pct=.03,
            max_holding_bars=1, min_samples=2)
        self.assertEqual(result["decision"], "WAIT")
        self.assertEqual(result["sample_count"], 0)


if __name__ == "__main__":
    unittest.main()
