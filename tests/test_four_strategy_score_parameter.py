"""Score normalization must be forwarded to each strategy's replay."""
import unittest
from p3.paper_engine import Decision
from p3.multi_model_replay import replay_four_models, STRATEGY_TIMEFRAMES


class ScorePropagationTests(unittest.TestCase):
    def test_score_k_reaches_each_strategy(self):
        bars = [
            {"open_time": 1, "close_time": 10, "open": 100, "high": 101, "low": 99, "close": 100},
            {"open_time": 11, "close_time": 20, "open": 100, "high": 101, "low": 99, "close": 100},
            {"open_time": 21, "close_time": 30, "open": 100, "high": 111, "low": 99, "close": 110},
        ]
        candles = {tf: {"BTCUSDT": bars} for tf in STRATEGY_TIMEFRAMES.values()}
        decisions = {s: {"BTCUSDT": {10: Decision("LONG", "BTCUSDT", 100, 110, 90, .2)}}
                     for s in STRATEGY_TIMEFRAMES}
        low = replay_four_models(candles, decisions, score_k=1)
        high = replay_four_models(candles, decisions, score_k=10)
        for strategy in STRATEGY_TIMEFRAMES:
            a = low[strategy]["metrics"]["mean_score_q"]
            b = high[strategy]["metrics"]["mean_score_q"]
            self.assertIsNotNone(a)
            self.assertGreater(a, b)


if __name__ == "__main__":
    unittest.main()
