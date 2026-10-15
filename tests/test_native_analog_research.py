import unittest
from p3.native_analog_research import run_native_analog_research


class NativeAnalogResearchTests(unittest.TestCase):
    def test_native_end_to_end_both_directions(self):
        calls = []
        feature_rows = []
        candle_rows = []
        for i in range(45):
            t = i * 3600000
            feature_rows.append({"symbol": "BTCUSDT", "timeframe": "1h",
                                 "open_time": t,
                                 "close_time": t + 3599999, "rsi_12": 40.0})
            candle_rows.append({"symbol": "BTCUSDT", "timeframe": "1h",
                                "open_time": t, "close_time": t + 3599999,
                                "open_price": "100", "high_price": "104",
                                "low_price": "99", "close_price": "103"})
        def db(method, table, params):
            calls.append(method)
            return feature_rows if table == "market_features" else candle_rows
        result = run_native_analog_research(
            db, symbol="BTCUSDT", timeframe="1h",
            asof_ms=45*3600000-1, features=("rsi_12",),
            stop_pct=.02, target_pct=.03, max_holding_bars=1,
            fee_rate=.001, slippage_rate=.001, k=40, min_samples=30)
        self.assertEqual(result["status"], "RESEARCH_COMPLETE")
        self.assertEqual(result["LONG"]["decision"], "CANDIDATE")
        self.assertEqual(result["SHORT"]["decision"], "WAIT")
        self.assertTrue(all(x == "GET" for x in calls))
        self.assertFalse(result["auto_trade_enabled"])

    def test_rejects_feature_misalignment(self):
        def db(method, table, params):
            if table == "market_features":
                return [{"symbol": "BTCUSDT", "timeframe": "1h",
                         "open_time": 0, "close_time": 3600000, "rsi_12": 40.0}]
            return [{"symbol": "BTCUSDT", "timeframe": "1h",
                     "open_time": 0, "close_time": 3599999,
                     "open_price": "100", "high_price": "104",
                     "low_price": "99", "close_price": "103"}]
        with self.assertRaises(ValueError):
            run_native_analog_research(
                db, symbol="BTCUSDT", timeframe="1h", asof_ms=3600000,
                features=("rsi_12",), stop_pct=.02, target_pct=.03,
                max_holding_bars=1, fee_rate=0, slippage_rate=0)


if __name__ == "__main__":
    unittest.main()
