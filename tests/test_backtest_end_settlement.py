"""Synthetic boundary settlement is not a market exit or an expiry rule."""
import unittest
from p3.paper_engine import Decision
from p3.multi_position_replay import replay_multi_positions


def candle(start, end, close):
    return {"open_time": start, "close_time": end, "open": close,
            "high": close + 1, "low": close - 1, "close": close, "volume": 10}


class BacktestEndSettlementTests(unittest.TestCase):
    def setUp(self):
        self.bars = {"BTCUSDT": [candle(1, 10, 100), candle(11, 20, 100)]}
        self.signals = {"BTCUSDT": {10: Decision("LONG", "BTCUSDT", 100, 110, 90, 0.5)}}

    def test_opt_in_settlement_returns_collateral_and_charges_both_fees(self):
        result = replay_multi_positions(self.bars, self.signals, fee_rate=0.001, settle_at_end=True)
        a = result["account"]
        self.assertEqual(len(a.positions), 0)
        self.assertEqual(len(a.closed_trades), 1)
        trade = a.closed_trades[0]
        self.assertEqual(trade["reason"], "BACKTEST_END_SETTLEMENT")
        self.assertIsNone(trade["exit_price"])
        self.assertAlmostEqual(trade["net_pnl"], -10)
        self.assertAlmostEqual(a.settled_equity, 9990)
        self.assertAlmostEqual(a.cash, 9990)
        self.assertEqual(result["metrics"]["backtest_end_settlement_count"], 1)
        self.assertEqual(result["metrics"]["normal_closed_trades"], 0)
        self.assertEqual(result["metrics"]["closed_trades"], 0)
        self.assertAlmostEqual(result["metrics"]["realized_net_pnl"], -10)
        self.assertEqual(result["metrics"]["backtest_end_settlement_percent"], 100)
        self.assertIsNone(result["metrics"]["win_rate_percent"])
        self.assertIsNone(result["metrics"]["mean_score_q"])
        self.assertAlmostEqual(result["metrics"]["annualized_return_percent"],
                               result["metrics"]["annualized_mark_to_market_return_percent"])

    def test_default_keeps_open_position_and_no_time_exit(self):
        result = replay_multi_positions(self.bars, self.signals, fee_rate=0.001)
        self.assertEqual(len(result["account"].positions), 1)
        self.assertEqual(result["metrics"]["backtest_end_settlement_count"], 0)
        self.assertIsNone(result["metrics"]["annualized_return_percent"])


if __name__ == "__main__":
    unittest.main()
