"""Independent lot and shared cash accounting invariants."""
import unittest
from p3.paper_engine import Decision
from p3.multi_position_account import MultiPositionAccount
from p3.multi_position_audit import audit_portfolio


class PortfolioAuditTests(unittest.TestCase):
    def test_two_assets_and_mark_to_market(self):
        a = MultiPositionAccount()
        a.enter(Decision("LONG", "BTCUSDT", 100, 110, 90, 0.2), 1)
        a.enter(Decision("SHORT", "ETHUSDT", 100, 90, 110, 0.2), 2)
        report = audit_portfolio(a, {"BTCUSDT": 110, "ETHUSDT": 90})
        self.assertEqual(report["open_lots"], 2)
        self.assertEqual(set(report["symbols"]), {"BTCUSDT", "ETHUSDT"})
        self.assertAlmostEqual(report["equity"], 10360)
        self.assertAlmostEqual(report["cash"] + report["reserved"] + report["unrealized"], report["equity"])

    def test_exit_one_lot_preserves_other(self):
        a = MultiPositionAccount()
        first, _ = a.enter(Decision("LONG", "BTCUSDT", 100, 110, 90, 0.2), 1)
        second, _ = a.enter(Decision("LONG", "ETHUSDT", 100, 110, 90, 0.2), 2)
        a.exit(first, 110, 3)
        report = audit_portfolio(a)
        self.assertEqual(report["open_lots"], 1)
        self.assertIn(second, a.positions)
        self.assertAlmostEqual(report["equity"], 10200)


if __name__ == "__main__":
    unittest.main()
