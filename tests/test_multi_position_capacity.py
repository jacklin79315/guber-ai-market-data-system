"""Settlement-based aggregate capacity for an isolated strategy account."""
import unittest
from p3.paper_engine import Decision
from p3.multi_position_account import MultiPositionAccount


def long(allocation, symbol="BTCUSDT"):
    return Decision("LONG", symbol, 100, 110, 90, allocation)


class SettledCapacityTests(unittest.TestCase):
    def test_total_entry_capacity_is_eighty_percent(self):
        a = MultiPositionAccount()
        self.assertIsNotNone(a.enter(long(.5), 1))
        self.assertIsNone(a.enter(long(.4), 2))
        self.assertIsNotNone(a.enter(long(.3), 3))
        self.assertAlmostEqual(a.reserved_notional, 8000)
        self.assertAlmostEqual(a.remaining_capacity, 0)

    def test_only_closed_profit_expands_capacity(self):
        a = MultiPositionAccount()
        first, _ = a.enter(long(.5), 1)
        a.enter(long(.3, "ETHUSDT"), 2)
        self.assertAlmostEqual(a.capacity_limit, 8000)
        self.assertAlmostEqual(a.equity({"BTCUSDT": 110}), 10500)
        self.assertAlmostEqual(a.capacity_limit, 8000)
        a.exit(first, 110, 3)
        self.assertAlmostEqual(a.settled_equity, 10500)
        self.assertAlmostEqual(a.capacity_limit, 8400)
        self.assertAlmostEqual(a.remaining_capacity, 5400)

    def test_loss_can_leave_open_lots_over_limit_without_forcing_exit(self):
        a = MultiPositionAccount()
        first, _ = a.enter(long(.2), 1)
        second, _ = a.enter(long(.6, "ETHUSDT"), 2)
        a.exit(first, 50, 3, reason="EXIT")
        self.assertAlmostEqual(a.settled_equity, 9000)
        self.assertAlmostEqual(a.capacity_limit, 7200)
        self.assertIn(second, a.positions)
        self.assertIsNone(a.enter(long(.1, "SOLUSDT"), 4))
        self.assertIn(second, a.positions)
        a.exit(second, 110, 5, reason="TP")
        self.assertEqual(len(a.positions), 0)


if __name__ == "__main__":
    unittest.main()
