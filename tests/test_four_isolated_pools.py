"""Four strategies must not share a multi-position cash pool."""
import unittest
from p3.multi_model_replay import replay_four_models, STRATEGY_TIMEFRAMES
from p3.paper_engine import Decision


class FourIsolatedPoolsTests(unittest.TestCase):
    def test_each_strategy_starts_with_its_own_ten_thousand(self):
        candles = {}
        decisions = {}
        for strategy, timeframe in STRATEGY_TIMEFRAMES.items():
            candles[timeframe] = {"BTCUSDT": [
                {"open_time": 1, "close_time": 10, "open": 100, "high": 101, "low": 99, "close": 100, "volume": 10},
                {"open_time": 11, "close_time": 20, "open": 100, "high": 101, "low": 99, "close": 100, "volume": 10},
            ]}
            decisions[strategy] = {"BTCUSDT": {10: Decision("LONG", "BTCUSDT", 100, 110, 90, .8)}}
        result = replay_four_models(candles, decisions)
        self.assertEqual(set(result), set(STRATEGY_TIMEFRAMES))
        accounts = [result[s]["account"] for s in STRATEGY_TIMEFRAMES]
        self.assertEqual(len({id(a) for a in accounts}), 4)
        for a in accounts:
            self.assertAlmostEqual(a.settled_equity, 10000)
            self.assertAlmostEqual(a.capacity_limit, 8000)
            self.assertAlmostEqual(a.reserved_notional, 8000)
            self.assertEqual(len(a.positions), 1)
        accounts[0].exit(1, 110, 21)
        self.assertAlmostEqual(accounts[0].capacity_limit, 8640)
        for a in accounts[1:]:
            self.assertAlmostEqual(a.capacity_limit, 8000)



if __name__ == "__main__":
    unittest.main()
