"""Integration contract for chronological research replay."""
import unittest
from unittest.mock import patch
from p3.walk_forward_replay import replay_walk_forward_research


class WalkForwardReplayTests(unittest.TestCase):
    def test_replay_passes_only_research_candles_and_preserves_boundaries(self):
        start, end = 1000, 4000
        candles = [
            {"close_time": 500},
            {"close_time": 1500},
            {"close_time": 2500},
            {"close_time": 4500},
        ]
        generated = {"decisions": {1500: "WAIT", 2500: "WAIT"},
                     "checkpoints": [{"status": "FITTED"}]}
        replayed = {"metrics": {"normal_closed_trades": 0,
                                "annualized_return_percent": None},
                    "signals": [], "events": []}
        with patch("p3.walk_forward_replay.generate_walk_forward_decisions",
                   return_value=generated) as gen, \
             patch("p3.walk_forward_replay.replay_multi_positions",
                   return_value=replayed) as replay:
            result = replay_walk_forward_research(
                candles, [], "INTRADAY", (start, end), fee_rate=0.001, symbol="BTCUSDT")
        self.assertEqual(gen.call_count, 1)
        self.assertEqual(
            [x["close_time"] for x in replay.call_args.args[0]["BTCUSDT"]],
            [1500, 2500])
        self.assertEqual(replay.call_args.kwargs["fee_rate"], 0.001)
        self.assertTrue(replay.call_args.kwargs["settle_at_end"])
        self.assertEqual(result["research_trades"], 0)
        self.assertFalse(result["independent_validation_performed"])
        self.assertFalse(result["trade_feedback_optimization_performed"])
        self.assertFalse(result["eligible_for_promotion"])

    def test_research_diagnosis_is_only_for_35_to_40_percent(self):
        candles = [{"close_time": 1500}]
        generated = {"decisions": {}, "checkpoints": []}
        for dd, expected in ((35, False), (38, True), (40, True), (40.01, False)):
            replayed = {
                "metrics": {"normal_closed_trades": 0,
                            "max_close_to_close_drawdown_percent": dd,
                            "signal_counts": {}},
                "signals": [], "events": [],
                "equity_curve": [
                    {"time_ms": 1, "equity": 10000, "open_lots": 0},
                    {"time_ms": 2, "equity": 6200, "open_lots": 2}],
            }
            with patch("p3.walk_forward_replay.generate_walk_forward_decisions",
                       return_value=generated), \
                 patch("p3.walk_forward_replay.replay_multi_positions",
                       return_value=replayed):
                result = replay_walk_forward_research(
                    candles, [], "INTRADAY", (1000, 4000), symbol="BTCUSDT")
            diagnosis = result["drawdown_failure_diagnosis"]
            self.assertEqual(diagnosis is not None, expected)
            if expected:
                self.assertFalse(diagnosis["eligible_for_candidate_selection"])

    def test_rejects_missing_symbol(self):
        candles = [{"close_time": 1500, "symbol": "BTCUSDT"},
                   {"close_time": 2500, "symbol": "BTCUSDT"}]
        with patch("p3.walk_forward_replay.generate_walk_forward_decisions",
                   return_value={"decisions": {}, "checkpoints": []}):
            with self.assertRaisesRegex(ValueError, "symbol must be provided"):
                replay_walk_forward_research(
                    candles, [], "INTRADAY", (1000, 4000))


if __name__ == "__main__":
    unittest.main()
