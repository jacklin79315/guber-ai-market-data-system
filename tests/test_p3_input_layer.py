"""P3A unit tests: no database or exchange credentials needed."""
import unittest
from p3.input_layer import assemble_observation, classify_volatility, InsufficientHistory


def candle(tf, open_ms, close_ms, atr=4.0):
    return {"symbol": "BTCUSDT", "timeframe": tf, "open_time": open_ms,
            "close_time": close_ms, "atr_percent": atr, "rsi_12": 51.0}


class TestInputLayer(unittest.TestCase):
    def test_volatility_uses_only_closed_days(self):
        days = [candle("1d", i * 86400000, (i + 1) * 86400000 - 1)
                for i in range(30)]
        days.append(candle("1d", 30 * 86400000, 31 * 86400000 - 1, 30.0))
        self.assertEqual(classify_volatility(days, 30 * 86400000)["band"], "LOW")

    def test_missing_daily_history_fails(self):
        with self.assertRaises(InsufficientHistory):
            classify_volatility([candle("1d", 0, 100)], 200)

    def test_no_future_candle_leakage(self):
        now = 31 * 86400000
        days = [candle("1d", i * 86400000, (i + 1) * 86400000 - 1)
                for i in range(31)]
        data = {tf: [candle(tf, now - {"15m":900000,"1h":3600000,"4h":14400000}[tf], now - 1), candle(tf, now, now + 100)]
                for tf in ("15m", "1h", "4h")}
        data["1d"] = days
        result = assemble_observation("BTCUSDT", now, data)
        self.assertEqual(result["timeframes"]["15m"]["close_time"], now - 1)
        self.assertEqual(result["volatility"]["observations"], 30)


    def test_stale_features_fail(self):
        now = 31 * 86400000
        days = [candle("1d", i * 86400000, (i + 1) * 86400000 - 1) for i in range(31)]
        data = {tf: [candle(tf, 0, 100)] for tf in ("15m", "1h", "4h")}
        data["1d"] = days
        with self.assertRaises(InsufficientHistory):
            assemble_observation("BTCUSDT", now, data)

    def test_daily_gap_fails(self):
        days = [candle("1d", i * 86400000, (i + 1) * 86400000 - 1) for i in range(29)]
        days.append(candle("1d", 30 * 86400000, 31 * 86400000 - 1))
        with self.assertRaises(InsufficientHistory):
            classify_volatility(days, 32 * 86400000)


if __name__ == "__main__":
    unittest.main()
