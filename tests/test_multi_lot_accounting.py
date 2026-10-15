"""Regression checks for multi-lot accounting and independent exits."""
import unittest
from p3.paper_engine import Decision
from p3.multi_position_account import MultiPositionAccount


class MultiLotAccountingTests(unittest.TestCase):
    def test_close_one_lot_does_not_count_collateral_twice(self):
        account = MultiPositionAccount()
        a = Decision("LONG", "BTCUSDT", 100, 110, 90, .2)
        b = Decision("LONG", "ETHUSDT", 100, 110, 90, .2)
        first_id, _ = account.enter(a, 1)
        second_id, _ = account.enter(b, 2)
        result = account.exit(first_id, 110, 3, reason="TP")
        self.assertAlmostEqual(result["equity_after"], 10200)
        self.assertAlmostEqual(account.equity(), 10200)
        self.assertIn(second_id, account.positions)
        self.assertNotIn(first_id, account.positions)
        self.assertEqual(len(account.closed_trades), 1)

    def test_independent_lot_stops_and_targets(self):
        account = MultiPositionAccount()
        a = Decision("LONG", "BTCUSDT", 100, 110, 90, .2)
        b = Decision("LONG", "BTCUSDT", 100, 120, 95, .2)
        first_id, _ = account.enter(a, 1)
        second_id, _ = account.enter(b, 2)
        account.exit(first_id, 110, 3, reason="TP")
        self.assertEqual(account.positions[second_id].decision.take_profit, 120)
        self.assertEqual(account.positions[second_id].decision.stop_loss, 95)
        self.assertEqual(len(account.positions), 1)


if __name__ == "__main__":
    unittest.main()
