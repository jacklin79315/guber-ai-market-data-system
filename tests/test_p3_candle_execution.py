import unittest
from p3.paper_engine import Decision, PaperAccount
from p3.candle_execution import process_closed_candle


def candle(start, end, low, high, open_price=100, close_price=100):
    return {"open_time": start, "close_time": end, "open": open_price,
            "high": high, "low": low, "close": close_price}


class TestCandleExecution(unittest.TestCase):
    def setUp(self):
        self.a = PaperAccount()
        self.a.enter(Decision("LONG", "BTCUSDT", 100, 110, 95, .5), 0)

    def test_no_trigger(self):
        self.assertIsNone(process_closed_candle(self.a, candle(1, 10, 98, 105)))
        self.assertIsNotNone(self.a.position)

    def test_stop_first_on_ambiguous_candle(self):
        result = process_closed_candle(self.a, candle(1, 10, 94, 111))
        self.assertEqual(result["reason"], "SL")
        self.assertTrue(result["ambiguous_fill"])

    def test_native_finer_candles_resolve_target_first(self):
        fine = [candle(1, 5, 98, 111), candle(6, 10, 94, 105)]
        result = process_closed_candle(self.a, candle(1, 10, 94, 111),
                                       lower_timeframe_candles=fine)
        self.assertEqual(result["reason"], "TP")
        self.assertFalse(result["ambiguous_fill"])

    def test_partial_finer_history_does_not_claim_resolution(self):
        fine = [candle(1, 5, 98, 111)]
        result = process_closed_candle(self.a, candle(1, 10, 94, 111),
                                       lower_timeframe_candles=fine)
        self.assertEqual(result["reason"], "SL")
        self.assertTrue(result["ambiguous_fill"])

    def test_time_limit(self):
        result = process_closed_candle(self.a, candle(1, 10, 98, 105),
                                       max_exit_time_ms=10)
        self.assertEqual(result["reason"], "TIME_LIMIT")

    def test_reject_incomplete_ohlc(self):
        with self.assertRaises(ValueError):
            process_closed_candle(self.a, {"open_time": 1, "close_time": 10})


if __name__ == "__main__":
    unittest.main()
