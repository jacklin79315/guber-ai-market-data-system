"""Regression checks for approved independent direction/structure training knobs."""
import unittest
import numpy as np

from p3.ai_decision_model import HorizonModel


class IndependentModelParamsTests(unittest.TestCase):
    def test_legacy_shared_parameters_remain_supported(self):
        model = HorizonModel(max_iter=80, learning_rate=0.07)
        self.assertEqual(model.direction.max_iter, 80)
        self.assertEqual(model.upside.max_iter, 80)
        self.assertEqual(model.downside.max_iter, 80)
        self.assertEqual(model.direction.learning_rate, 0.07)
        self.assertEqual(model.upside.learning_rate, 0.07)

    def test_direction_and_structure_parameters_are_independent(self):
        model = HorizonModel(
            max_iter=80, learning_rate=0.07,
            direction_max_iter=130, direction_learning_rate=0.03,
            structure_max_iter=210, structure_learning_rate=0.11,
        )
        self.assertEqual(model.direction.max_iter, 130)
        self.assertEqual(model.direction.learning_rate, 0.03)
        self.assertEqual(model.upside.max_iter, 210)
        self.assertEqual(model.downside.max_iter, 210)
        self.assertEqual(model.upside.learning_rate, 0.11)
        self.assertEqual(model.downside.learning_rate, 0.11)

    def test_fit_and_inference_feature_indices(self):
        from p3.ai_decision_model import FEATURE_COLUMNS
        model = HorizonModel(max_iter=5)
        rng = np.random.default_rng(42)
        X = rng.normal(size=(120, len(FEATURE_COLUMNS)))
        y_direction = np.array([0, 1] * 60)
        y_up = rng.uniform(0.01, 0.08, size=120)
        y_down = rng.uniform(0.01, 0.08, size=120)
        model.fit(X, y_direction, y_up, y_down)
        row = dict(zip(FEATURE_COLUMNS, X[0].tolist()))
        row["close_price"] = 100.0
        probability = model.analyze_direction(row)
        entry, up, down = model.analyze_price_structure(row)
        self.assertTrue(0 <= probability <= 1)
        self.assertEqual(entry, 100.0)
        self.assertGreaterEqual(up, 0)
        self.assertGreaterEqual(down, 0)


if __name__ == "__main__":
    unittest.main()
