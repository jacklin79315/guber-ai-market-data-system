"""A strategy horizon is not a forced closing deadline."""
import unittest
from p3.paper_engine import Decision
from p3.multi_position_replay import replay_multi_positions


def candle(start, end, low=99, high=101):
    return {"open_time": start, "close_time": end, "open": 100,
            "high": high, "low": low, "close": 100, "volume": 1}


class NoForcedTimeExitTests(unittest.TestCase):
    def test_lots_remain_open_regardless_of_elapsed_bars(self):
        bars = [candle(1, 10), candle(11, 20), candle(21, 30),
                candle(31, 40), candle(41, 50), candle(51, 60)]
        decision = Decision("LONG", "BTCUSDT", 100, 120, 80, .2)
        result = replay_multi_positions(
            {"BTCUSDT": bars}, {"BTCUSDT": {10: decision, 20: decision}})
        self.assertEqual(result["closed_trades"], 0)
        self.assertEqual(result["open_lots"], 2)
        self.assertFalse(any(e["type"] == "EXIT" for e in result["events"]))
        self.assertAlmostEqual(result["settled_equity"], 10000)

    def test_stop_still_closes_lot_after_extended_holding(self):
        bars = [candle(1, 10), candle(11, 20), candle(21, 30),
                candle(31, 40), candle(41, 50, low=89)]
        decision = Decision("LONG", "BTCUSDT", 100, 120, 90, .2)
        result = replay_multi_positions(
            {"BTCUSDT": bars}, {"BTCUSDT": {10: decision}})
        exits = [e for e in result["events"] if e["type"] == "EXIT"]
        self.assertEqual(len(exits), 1)
        self.assertEqual(exits[0]["reason"], "SL")


if __name__ == "__main__":
    unittest.main()
