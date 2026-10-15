import unittest
from unittest.mock import patch
from p3.generation_evaluator import compare_current_generation


class GenerationEvaluatorTests(unittest.TestCase):
    def test_first_generation_is_baseline(self):
        with patch.dict("os.environ", {"TRAINING_GENERATION": "1"}):
            report = compare_current_generation(None, symbol="BTCUSDT",
                strategy="ONE_WEEK", years=1, candles=[], features=[],
                fee_rate=0, ranking=[])
        self.assertEqual(report["status"], "BASELINE")

    def test_no_challenger_waits(self):
        with patch.dict("os.environ", {"TRAINING_GENERATION": "2"}):
            report = compare_current_generation(None, symbol="BTCUSDT",
                strategy="ONE_WEEK", years=1, candles=[], features=[],
                fee_rate=0, ranking=[])
        self.assertEqual(report["status"], "WAIT")


if __name__ == "__main__":
    unittest.main()
