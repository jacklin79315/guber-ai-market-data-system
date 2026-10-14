import unittest
from p3.paper_engine import PaperAccount, Decision
from p3.performance import summarize


class TestPerformance(unittest.TestCase):
    def test_empty_account(self):
        m = summarize(PaperAccount())
        self.assertEqual(m["closed_trades"], 0)
        self.assertIsNone(m["mean_score_q"])
        self.assertIsNone(m["win_rate_percent"])

    def test_one_profitable_trade(self):
        a = PaperAccount()
        a.enter(Decision("LONG", "BTCUSDT", 100, 110, 95, .5), 1)
        a.exit(110, 2, reason="TP")
        m = summarize(a, elapsed_ms=365.25 * 24 * 60 * 60 * 1000)
        self.assertEqual(m["closed_trades"], 1)
        self.assertAlmostEqual(m["realized_net_pnl"], 500)
        self.assertAlmostEqual(m["annualized_return_percent"], 5)
        self.assertAlmostEqual(m["mean_trade_return_percent"], 5)
        self.assertAlmostEqual(m["mean_planned_rr"], 2)
        self.assertAlmostEqual(m["max_realized_drawdown_percent"], 0)
        self.assertEqual(m["win_rate_percent"], 100)
        self.assertGreater(m["mean_score_q"], 50)

    def test_open_position_has_no_annualized_return(self):
        a = PaperAccount()
        a.enter(Decision("SHORT", "BTCUSDT", 100, 90, 105, .5), 1)
        m = summarize(a, elapsed_ms=365.25 * 24 * 60 * 60 * 1000)
        self.assertTrue(m["has_open_position"])
        self.assertIsNone(m["annualized_return_percent"])

    def test_realized_drawdown_from_closed_equity(self):
        a = PaperAccount()
        a.enter(Decision("LONG", "BTCUSDT", 100, 110, 95, .5), 1)
        a.exit(110, 2)
        a.enter(Decision("LONG", "BTCUSDT", 100, 110, 95, .5), 3)
        a.exit(90, 4)
        m = summarize(a)
        self.assertAlmostEqual(m["max_realized_drawdown_percent"], 5)
        self.assertAlmostEqual(m["mean_planned_rr"], 2)

    def test_invalid_score_scale(self):
        with self.assertRaises(ValueError):
            summarize(PaperAccount(), score_k=0)


if __name__ == "__main__":
    unittest.main()
