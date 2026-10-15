"""Multi-lot holding time exits must not affect other open lots."""
import unittest
from p3.paper_engine import Decision
from p3.multi_position_replay import replay_multi_positions


def candle(start, end, high=101, low=99):
    return {"open_time": start, "close_time": end, "open": 100,
            "high": high, "low": low, "close": 100, "volume": 1}


class MultiLotTimeLimitTests(unittest.TestCase):
    def test_each_lot_exits_independently_at_time_limit(self):
        bars = [candle(1, 10), candle(11, 20), candle(21, 30),
                candle(31, 40), candle(41, 50)]
        d = Decision("LONG", "BTCUSDT", 100, 120, 80, .2)
        result = replay_multi_positions(
            {"BTCUSDT": bars}, {"BTCUSDT": {10: d, 20: d}},
            max_holding_ms=20)
        exits = [e for e in result["events"] if e["type"] == "EXIT"]
        self.assertEqual(len(exits), 2)
        self.assertEqual([e["reason"] for e in exits], ["TIME_LIMIT", "TIME_LIMIT"])
        self.assertEqual([e["exit_time_ms"] for e in exits], [40, 50])
        self.assertEqual(len({e["lot_id"] for e in exits}), 2)

    def test_stop_loss_precedes_time_limit(self):
        bars = [candle(1, 10), candle(11, 20), candle(21, 30, high=101, low=89)]
        d = Decision("LONG", "BTCUSDT", 100, 120, 90, .2)
        result = replay_multi_positions(
            {"BTCUSDT": bars}, {"BTCUSDT": {10: d}}, max_holding_ms=10)
        exits = [e for e in result["events"] if e["type"] == "EXIT"]
        self.assertEqual(len(exits), 1)
        self.assertEqual(exits[0]["reason"], "SL")


if __name__ == "__main__":
    unittest.main()
