"""Replay Supabase-derived point-in-time summary fixtures without credentials.

Timestamps and 30-day ATR means are based on a read-only Supabase SQL query.
The individual ATR rows are synthetic constants matching those means.
This does not validate exact source rows or network connectivity.
"""
import unittest
from p3.feature_loader import load_observation

DAY = 86400000


class TestRealSnapshot(unittest.TestCase):
    def test_latest_snapshots(self):
        now = 1792016099999
        for symbol, daily_avg in (("BTCUSDT", 2.73308), ("ETHUSDT", 3.63521)):
            rows = {
                "15m": [{"symbol": symbol, "timeframe": "15m",
                         "open_time": 1792015200000, "close_time": now,
                         "atr_percent": 0.2}],
                "1h": [{"symbol": symbol, "timeframe": "1h",
                        "open_time": 1792011600000, "close_time": 1792015199999,
                        "atr_percent": 0.5}],
                "4h": [{"symbol": symbol, "timeframe": "4h",
                        "open_time": 1791993600000, "close_time": 1792007999999,
                        "atr_percent": 1.0}],
                "1d": [{"symbol": symbol, "timeframe": "1d",
                        "open_time": 1789344000000 + i * DAY,
                        "close_time": 1789344000000 + (i + 1) * DAY - 1,
                        "atr_percent": daily_avg} for i in range(30)],
            }

            def db(method, table, params):
                self.assertEqual((method, table), ("GET", "market_features"))
                return list(reversed(rows[params["timeframe"][3:]]))

            observation = load_observation(db, symbol, now)
            self.assertEqual(observation["volatility"]["band"], "LOW")
            self.assertAlmostEqual(observation["volatility"]["atr_percent_30d_mean"], daily_avg)
            self.assertEqual(set(observation["timeframes"]), set(rows))


if __name__ == "__main__":
    unittest.main()
