import unittest
from p3.walk_forward_diagnostics import diagnose_drawdown, diagnose_eligible_trades


class DrawdownDiagnosisTests(unittest.TestCase):
    def replay(self, dd):
        return {
            "metrics": {"max_close_to_close_drawdown_percent": dd,
                        "signal_counts": {"INSUFFICIENT_CASH": 2},
                        "ambiguous_exit_count": 0,
                        "entry_bars_with_unresolved_exit": 1},
            "events": [
                {"type": "EXIT", "net_pnl": -100, "reason": "SL"},
                {"type": "EXIT", "net_pnl": 20, "reason": "TP"}],
            "equity_curve": [
                {"time_ms": 1, "equity": 10000, "open_lots": 0},
                {"time_ms": 2, "equity": 6200, "open_lots": 3}],
        }

    def test_diagnostic_only_in_35_to_40_band(self):
        for dd in (8, 35, 40.01, 50):
            self.assertIsNone(diagnose_drawdown(self.replay(dd)))
        for dd in (35.01, 40):
            result = diagnose_drawdown(self.replay(dd))
            self.assertEqual(result["status"], "FAILURE_DIAGNOSIS_ONLY")
            self.assertFalse(result["eligible_for_candidate_selection"])
            self.assertEqual(result["loss_exit_events"], 1)
            self.assertEqual(result["stop_loss_exit_events"], 1)
            self.assertEqual(result["max_drawdown_episode"]["open_lots_at_trough"], 3)


class EligibleTradeDiagnosisTests(unittest.TestCase):
    def test_directional_evidence_and_missing_side(self):
        replay = {"metrics": {"max_close_to_close_drawdown_percent": 20,
                              "signal_counts": {"INSUFFICIENT_CASH": 4,
                                                "NOT_FILLED": 3}},
                  "events": [{"type": "EXIT", "side": "LONG", "net_pnl": -12, "reason": "SL"},
                             {"type": "EXIT", "side": "LONG", "net_pnl": 20, "reason": "TP"},
                             {"type": "EXIT", "side": "SHORT", "net_pnl": -5, "reason": "SL"},
                             {"type": "EXIT", "net_pnl": -1, "reason": "SL"},
                             {"type": "BACKTEST_END_SETTLEMENT", "side": "LONG", "net_pnl": -2}]}
        result = diagnose_eligible_trades(replay)
        self.assertEqual(result["closed_trade_events"], 4)
        self.assertEqual(result["by_direction"]["LONG"]["win_rate_percent"], 50)
        self.assertEqual(result["by_direction"]["SHORT"]["losses"], 1)
        self.assertEqual(result["missing_direction_events"], 1)
        self.assertEqual(result["insufficient_cash_signals"], 4)
        self.assertFalse(result["eligible_for_candidate_selection"])

    def test_entry_context_joins_by_lot_and_decision_timestamp(self):
        replay = {"metrics": {"max_close_to_close_drawdown_percent": 10},
                  "signals": [{"symbol": "BTCUSDT", "decision_time_ms": 100,
                               "outcome": "FILLED"}],
                  "events": [{"type": "ENTRY", "lot_id": 7, "symbol": "BTCUSDT",
                              "decision_time_ms": 100, "entry_bar_exit_unresolved": True},
                             {"type": "EXIT", "lot_id": 7, "side": "LONG",
                              "net_pnl": -5, "planned_rr": 2.5, "reason": "SL"}]}
        context = diagnose_eligible_trades(replay)["entry_context"]
        self.assertEqual(context["matched_trades"], 1)
        self.assertEqual(context["unmatched_trades"], 0)
        self.assertEqual(context["mean_planned_rr"], 2.5)
        self.assertEqual(context["entry_bar_exit_unresolved"], 1)

    def test_high_drawdown_excluded_from_learning_evidence(self):
        for dd in (35.01, 40, 40.01, 90):
            self.assertIsNone(diagnose_eligible_trades({"metrics": {
                "max_close_to_close_drawdown_percent": dd}, "events": []}))


if __name__ == "__main__":
    unittest.main()
