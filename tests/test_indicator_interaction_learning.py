"""Acceptance test: AI learns conflicting indicator combinations, not consensus rules."""
import unittest
import numpy as np
from p3.ai_decision_model import FEATURE_COLUMNS, HorizonModel


class IndicatorInteractionLearningTests(unittest.TestCase):
    def test_conflicting_indicators_jointly_predict_future_direction(self):
        rng = np.random.default_rng(123)
        n = 2400
        X = rng.normal(size=(n, len(FEATURE_COLUMNS)))
        rsi = FEATURE_COLUMNS.index("rsi_12")
        macd = FEATURE_COLUMNS.index("macd_histogram")
        # Neither indicator by itself determines direction; their interaction does.
        labels = np.logical_xor(X[:, rsi] > 0, X[:, macd] > 0).astype(int)
        upside = np.where(labels == 1, 0.03, 0.01)
        downside = np.where(labels == 0, 0.03, 0.01)
        model = HorizonModel(max_iter=120, learning_rate=0.1)
        model.fit(X[:1800], labels[:1800], upside[:1800], downside[:1800])
        predicted = model.direction.predict(X[1800:])
        accuracy = float(np.mean(predicted == labels[1800:]))
        # Synthetic out-of-sample interaction test; not a claim about market returns.
        self.assertGreater(accuracy, 0.90)
        self.assertGreater(accuracy, max(
            np.mean((X[1800:, rsi] > 0) == labels[1800:]),
            np.mean((X[1800:, macd] > 0) == labels[1800:]),
        ) + 0.20)


if __name__ == "__main__":
    unittest.main()
