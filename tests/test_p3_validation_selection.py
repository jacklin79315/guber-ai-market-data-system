import unittest
from unittest.mock import patch
from p3.validation_selection import select_threshold, THRESHOLDS


class ValidationSelectionTests(unittest.TestCase):
    def test_uses_validation_window_and_selects_risk_adjusted_winner(self):
        seen = []
        def fake_evaluate(candles, features, model, symbol, window, threshold, fee_rate):
            seen.append((window, threshold))
            returns = {0.55: 4.0, 0.60: 5.0, 0.65: 3.0, 0.70: 20.0}
            counts = {0.55: 12, 0.60: 12, 0.65: 12, 0.70: 2}
            return {"metrics": {"closed_trades": counts[threshold],
                                "final_mark_to_market_equity": 10000 + returns[threshold] * 100,
                                "max_close_to_close_drawdown_percent": 1.0,
                                "execution_path_uncertain": False}}
        with patch("p3.validation_selection.evaluate_window", side_effect=fake_evaluate):
            result = select_threshold([], [], None, "BTCUSDT", (100, 200), 0.001)
        self.assertEqual(result["selected_threshold"], 0.60)
        self.assertEqual(seen, [((100, 200), t) for t in THRESHOLDS])
        self.assertEqual(result["selection_source"], "validation_only")

    def test_ambiguous_validation_is_ineligible(self):
        def fake_evaluate(*args):
            return {"metrics": {"closed_trades": 12,
                                "final_mark_to_market_equity": 11000,
                                "max_close_to_close_drawdown_percent": 2,
                                "execution_path_uncertain": True}}
        with patch("p3.validation_selection.evaluate_window", side_effect=fake_evaluate):
            result = select_threshold([], [], None, "BTCUSDT", (100, 200), 0.001)
        self.assertIsNone(result["selected_threshold"])

    def test_high_drawdown_is_ineligible(self):
        def fake_evaluate(*args):
            return {"metrics": {"closed_trades": 12,
                                "final_mark_to_market_equity": 12000,
                                "max_close_to_close_drawdown_percent": 9,
                                "execution_path_uncertain": False}}
        with patch("p3.validation_selection.evaluate_window", side_effect=fake_evaluate):
            result = select_threshold([], [], None, "BTCUSDT", (100, 200), 0.001)
        self.assertIsNone(result["selected_threshold"])

    def test_no_eligible_candidate_returns_none(self):
        def fake_evaluate(*args):
            return {"metrics": {"closed_trades": 0,
                                "final_mark_to_market_equity": 10000,
                                "max_close_to_close_drawdown_percent": 0,
                                "execution_path_uncertain": False}}
        with patch("p3.validation_selection.evaluate_window", side_effect=fake_evaluate):
            result = select_threshold([], [], None, "BTCUSDT", (100, 200), 0.001)
        self.assertIsNone(result["selected_threshold"])


if __name__ == "__main__":
    unittest.main()
