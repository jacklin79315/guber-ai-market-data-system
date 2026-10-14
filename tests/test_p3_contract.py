"""P3A contract verification with deterministic PostgREST fixtures.

Run: python -m unittest discover -s tests -p 'test_p3*.py'
"""
import unittest
from p3.feature_loader import load_observation
from p3.input_layer import InsufficientHistory

DAY = 86400000


def fixture(symbol, now):
    rows = {}
    for tf in ("15m", "1h", "4h"):
        rows[tf] = [{"symbol": symbol, "timeframe": tf,
                     "open_time": now - 1000, "close_time": now - 1,
                     "atr_percent": 1.0}]
    rows["1d"] = [{"symbol": symbol, "timeframe": "1d",
                    "open_time": i * DAY, "close_time": (i + 1) * DAY - 1,
                    "atr_percent": 2.5} for i in range(1, 31)]
    return rows


class TestContract(unittest.TestCase):
    def test_both_symbols_four_native_timeframes(self):
        now = 31 * DAY
        for symbol in ("BTCUSDT", "ETHUSDT"):
            data = fixture(symbol, now)
            def db(method, table, params):
                self.assertEqual((method, table), ("GET", "market_features"))
                self.assertEqual(params["symbol"], "eq." + symbol)
                self.assertEqual(params["close_time"], "lte." + str(now))
                tf = params["timeframe"][3:]
                return list(reversed(data[tf]))
            obs = load_observation(db, symbol, now)
            self.assertEqual(set(obs["timeframes"]), {"15m", "1h", "4h", "1d"})
            self.assertEqual(obs["volatility"]["band"], "LOW")

    def test_future_metadata_is_rejected(self):
        now = 31 * DAY
        data = fixture("BTCUSDT", now)
        def db(method, table, params):
            return list(reversed(data[params["timeframe"][3:]]))
        with self.assertRaises(ValueError):
            load_observation(db, "BTCUSDT", now,
                             asset_metadata={"as_of_time_ms": now + 1})


if __name__ == "__main__":
    unittest.main()
