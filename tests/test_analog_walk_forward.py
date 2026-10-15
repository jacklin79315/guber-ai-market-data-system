import unittest
from p3.analog_walk_forward import walk_forward_analog_evaluation


class AnalogWalkForwardTests(unittest.TestCase):
    def test_frozen_plan_never_uses_future_labels(self):
        candles = []
        snapshots = []
        for i in range(8):
            t = i * 100
            snapshots.append({"timestamp_ms": t+9, "rsi": 30})
            candles.append({"open_time": t+10, "close_time": t+19,
                            "open": 100, "high": 104, "low": 99, "close": 103})
        report = walk_forward_analog_evaluation(
            snapshots, candles, ["rsi"], horizon_ms=20,
            direction="LONG", stop_pct=.02, target_pct=.03,
            max_holding_bars=1, fee_rate=0, slippage_rate=0,
            k=5, min_samples=2, evaluation_start_ms=209)
        self.assertEqual(report["evaluations"], 6)
        self.assertEqual(report["results"][0]["sample_count"], 2)
        self.assertEqual(report["results"][0]["decision"], "CANDIDATE")
        self.assertEqual(report["candidate_count"], 6)
        self.assertTrue(report["research_only"])
        self.assertEqual(report["realized_candidate_count"], 6)
        self.assertGreater(report["realized_net_expectancy_r"], 0)
        self.assertEqual(report["unresolved_candidate_count"], 0)


if __name__ == "__main__":
    unittest.main()
