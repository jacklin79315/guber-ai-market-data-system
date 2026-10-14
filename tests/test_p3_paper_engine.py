import unittest
from p3.paper_engine import Decision, PaperAccount, reward


class TestPaperEngine(unittest.TestCase):
    def test_wait_does_not_trade(self):
        a = PaperAccount()
        self.assertIsNone(a.enter(Decision("WAIT", "BTCUSDT"), 1))
        self.assertEqual(a.cash, 10000)

    def test_long_profit_and_costs(self):
        a = PaperAccount()
        a.enter(Decision("LONG", "BTCUSDT", 100, 110, 95, .5), 1,
                fee_rate=.001)
        a.mark(98, 105)
        t = a.exit(110, 2, fee_rate=.001, reason="TP")
        self.assertAlmostEqual(t["net_pnl"], 489.5)
        self.assertAlmostEqual(a.cash, 10489.5)
        self.assertAlmostEqual(t["mae_percent"], 2)

    def test_synthetic_short_profit(self):
        a = PaperAccount()
        a.enter(Decision("SHORT", "ETHUSDT", 100, 90, 105, .5), 1)
        a.mark(90, 102)
        t = a.exit(90, 2)
        self.assertAlmostEqual(t["net_pnl"], 500)
        self.assertAlmostEqual(a.cash, 10500)

    def test_loss_reward_and_mae_bucket(self):
        self.assertAlmostEqual(reward(-100, 10000, 12), -1.5)
        self.assertAlmostEqual(reward(100, 10000, 12), .85)

    def test_reject_overallocation(self):
        with self.assertRaises(ValueError):
            PaperAccount().enter(Decision("LONG", "BTCUSDT", 100, 110, 90, .81), 1)

    def test_reject_inverted_target_stop(self):
        with self.assertRaises(ValueError):
            PaperAccount().enter(Decision("SHORT", "BTCUSDT", 100, 110, 90, .5), 1)

    def test_reject_second_open_position(self):
        a = PaperAccount()
        d = Decision("LONG", "BTCUSDT", 100, 110, 90, .5)
        a.enter(d, 1)
        with self.assertRaises(ValueError):
            a.enter(d, 2)


if __name__ == "__main__":
    unittest.main()
