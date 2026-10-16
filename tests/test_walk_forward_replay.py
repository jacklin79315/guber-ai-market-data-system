"""Integration contract for chronological research replay."""
import unittest
from unittest.mock import patch
from p3.walk_forward_replay import replay_walk_forward_research


class WalkForwardReplayTests(unittest.TestCase):
    def test_replay_passes_only_research_candles_and_preserves_boundaries(self):
        start, end = 1000, 4000
        candles = [
            {"close_time": 500, "symbol": "BTCUSDT"},
            {"close_time": 1500, "symbol": "BTCUSDT"},
            {"close_time": 2500, "symbol": "BTCUSDT"},
            {"close_time": 4500, "symbol": "BTCUSDT"},
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
                candles, [], "INTRADAY", (start, end), fee_rate=0.001)
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

    def test_rejects_mixed_symbols(self):
        candles = [{"close_time": 1500, "symbol": "BTCUSDT"},
                   {"close_time": 2500, "symbol": "ETHUSDT"}]
        with patch("p3.walk_forward_replay.generate_walk_forward_decisions",
                   return_value={"decisions": {}, "checkpoints": []}):
            with self.assertRaisesRegex(ValueError, "one symbol"):
                replay_walk_forward_research(
                    candles, [], "INTRADAY", (1000, 4000))


if __name__ == "__main__":
    unittest.main()
