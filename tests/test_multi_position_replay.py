"""Independent multi-lot replay regression tests."""
import unittest
from p3.paper_engine import Decision
from p3.multi_position_replay import replay_multi_positions


def bars(prices):
    out = []
    for i, (low, high, close) in enumerate(prices):
        t = i * 60000
        out.append({"open_time": t, "close_time": t + 59999,
                    "open": close, "high": high, "low": low, "close": close})
    return out


def long(symbol, entry=100, allocation=0.2):
    return Decision("LONG", symbol, entry=entry, take_profit=110,
                    stop_loss=90, allocation=allocation)


class MultiPositionReplayTests(unittest.TestCase):
    def test_two_symbols_share_cash_and_hold_simultaneously(self):
        candles = {s: bars([(99, 101, 100)] * 3) for s in ("BTCUSDT", "ETHUSDT")}
        decisions = {s: {59999: long(s)} for s in candles}
        result = replay_multi_positions(candles, decisions)
        self.assertEqual(result["open_lots"], 2)
        self.assertEqual(result["closed_trades"], 0)
        self.assertEqual({p.decision.symbol for p in result["account"].positions.values()},
                         {"BTCUSDT", "ETHUSDT"})
        self.assertAlmostEqual(result["account"].equity(), 10000)

    def test_same_symbol_scale_in_without_averaging_lots(self):
        candles = {"BTCUSDT": bars([(99, 101, 100)] * 4)}
        decisions = {"BTCUSDT": {59999: long("BTCUSDT"),
                                  179999: long("BTCUSDT")}}
        result = replay_multi_positions(candles, decisions)
        self.assertEqual(result["open_lots"], 2)
        self.assertEqual(sorted(result["account"].positions), [1, 2])

    def test_independent_exit_and_unrealized_position(self):
        candles = {"BTCUSDT": bars([(99, 101, 100), (99, 101, 100),
                                      (99, 111, 105)])}
        decisions = {"BTCUSDT": {59999: long("BTCUSDT")}}
        result = replay_multi_positions(candles, decisions)
        self.assertEqual(result["closed_trades"], 1)
        self.assertEqual(result["open_lots"], 0)
        self.assertEqual(result["events"][-1]["reason"], "TP")

    def test_insufficient_cash_rejects_without_leverage(self):
        candles = {s: bars([(99, 101, 100)] * 3) for s in ("BTCUSDT", "ETHUSDT")}
        decisions = {s: {59999: long(s, allocation=0.8)} for s in candles}
        result = replay_multi_positions(candles, decisions)
        self.assertEqual(result["open_lots"], 1)
        self.assertEqual(len([e for e in result["events"] if e["type"] == "REJECTED"]), 1)


if __name__ == "__main__":
    unittest.main()
