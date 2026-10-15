"""Regression checks for approved independent direction/structure training knobs."""
import unittest

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


if __name__ == "__main__":
    unittest.main()
