"""Regression tests for configurable per-side replay fees."""
import unittest
from p3.fee_schedule import load_fee_rate

class TestFeeSchedule(unittest.TestCase):
    def test_load_binance_spot_fee(self):
        def db(method, table, params):
            self.assertEqual(method, "GET")
            self.assertEqual(table, "instrument_fee_schedule")
            self.assertEqual(params["category"], "eq.CRYPTO")
            return [{"buy_fee_rate": "0.001", "sell_fee_rate": "0.001"}]
        self.assertEqual(load_fee_rate(db), 0.001)

    def test_missing_fee_fails_closed(self):
        with self.assertRaises(ValueError):
            load_fee_rate(lambda *args: [])

    def test_asymmetric_fee_rejected(self):
        with self.assertRaises(ValueError):
            load_fee_rate(lambda *args: [{"buy_fee_rate": "0.001", "sell_fee_rate": "0.002"}])

if __name__ == "__main__":
    unittest.main()
