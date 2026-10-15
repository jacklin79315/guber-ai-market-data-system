import unittest
from p3.four_strategy_analog import STRATEGY_PLANS, research_horizon_ms
from p3.multi_model_replay import STRATEGY_TIMEFRAMES

class FourStrategyAnalogTests(unittest.TestCase):
    def test_original_four_strategies_preserved(self):
        self.assertEqual({k: v["timeframe"] for k,v in STRATEGY_PLANS.items()},
                         STRATEGY_TIMEFRAMES)

    def test_independent_horizons_are_not_one_bar(self):
        expected = {"INTRADAY": 4 * 3600000,
                    "ONE_TO_THREE_DAYS": 48 * 3600000,
                    "ONE_WEEK": 7 * 86400000,
                    "FIFTEEN_TO_THIRTY_DAYS": 21 * 86400000}
        for strategy, ms in expected.items():
            self.assertEqual(research_horizon_ms(strategy), ms)
            self.assertGreater(STRATEGY_PLANS[strategy]["max_holding_bars"], 1)
