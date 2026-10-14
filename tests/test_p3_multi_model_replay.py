import unittest
from p3.paper_engine import Decision
from p3.multi_model_replay import replay_four_models, STRATEGY_TIMEFRAMES


def candle(start, close, low=99, high=101, last=100):
    return {"open_time": start, "close_time": close, "open": 100,
            "high": high, "low": low, "close": last}


class TestMultiModelReplay(unittest.TestCase):
    def test_four_accounts_are_independent(self):
        bars = [candle(1, 1000), candle(1001, 2000),
                candle(2001, 3000, 98, 111, 108)]
        inputs = {tf: list(bars) for tf in STRATEGY_TIMEFRAMES.values()}
        decisions = {
            strategy: {1000: Decision("WAIT", "BTCUSDT")}
            for strategy in STRATEGY_TIMEFRAMES
        }
        decisions["INTRADAY"] = {
            1000: Decision("LONG", "BTCUSDT", 100, 110, 95, .5)
        }
        results = replay_four_models(inputs, decisions)
        self.assertEqual(len(results), 4)
        self.assertAlmostEqual(results["INTRADAY"]["account"].cash, 10500)
        for strategy in STRATEGY_TIMEFRAMES:
            if strategy != "INTRADAY":
                self.assertAlmostEqual(results[strategy]["account"].cash, 10000)
                self.assertEqual(results[strategy]["metrics"]["closed_trades"], 0)
        self.assertIsNot(results["INTRADAY"]["account"],
                         results["ONE_WEEK"]["account"])

    def test_missing_native_feed_is_explicit(self):
        with self.assertRaises(ValueError):
            replay_four_models({}, {})


if __name__ == "__main__":
    unittest.main()
