"""Checks that walk-forward model fitting never receives future labels."""
import unittest
from unittest.mock import patch
from datetime import datetime, timezone
import numpy as np
from p3.walk_forward_decisions import generate_walk_forward_decisions, monthly_checkpoints


def ms(y, m, d):
    return int(datetime(y, m, d, tzinfo=timezone.utc).timestamp() * 1000)


class _FakeModel:
    fit_sizes = []

    def __init__(self, **kwargs):
        pass

    def fit(self, X, y, up, down):
        self.fit_sizes.append(len(X))
        return self

    def decide(self, symbol, row, *, confidence_threshold):
        return "WAIT"


class WalkForwardDecisionTests(unittest.TestCase):
    def test_calendar_checkpoints(self):
        self.assertEqual(
            monthly_checkpoints(ms(2025, 1, 1), ms(2025, 3, 1)),
            [(ms(2025, 1, 1), ms(2025, 2, 1)),
             (ms(2025, 2, 1), ms(2025, 3, 1))])

    def test_only_matured_labels_used(self):
        start, end = ms(2025, 1, 1), ms(2025, 3, 1)
        interval = 900000
        times = list(range(start - 200 * interval, end, interval))
        n = len(times)
        X = np.ones((n, 20))
        y = np.asarray([i % 2 for i in range(n)])
        values = np.ones(n)
        candles = [{"close_time": t, "symbol": "BTCUSDT"} for t in times]
        features = [{"close_time": t} for t in times]
        _FakeModel.fit_sizes = []
        with patch("p3.walk_forward_decisions.check_research_coverage"), \
             patch("p3.walk_forward_decisions.build_supervised_examples",
                   return_value=(X, y, values, values, times)), \
             patch("p3.walk_forward_decisions.HorizonModel", _FakeModel):
            result = generate_walk_forward_decisions(
                candles, features, "INTRADAY", (start, end), symbol="BTCUSDT")
        for item in result["checkpoints"]:
            if item["status"] == "FITTED":
                self.assertLess(item["last_training_label_close_ms"],
                                item["start_ms"])
        self.assertEqual(len(_FakeModel.fit_sizes), 2)
        self.assertGreater(_FakeModel.fit_sizes[1], _FakeModel.fit_sizes[0])
        self.assertFalse(result["trade_feedback_optimization_performed"])


if __name__ == "__main__":
    unittest.main()
