import unittest
from p3.walk_forward_diagnostics import diagnose_drawdown


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


if __name__ == "__main__":
    unittest.main()
