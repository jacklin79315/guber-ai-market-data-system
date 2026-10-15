"""Regression test: bounded analog ranking matches full sorting exactly."""
import unittest
from math import isclose
from p3.historical_similarity import search_historical_analogs


class AnalogRankingParityTests(unittest.TestCase):
    def test_bounded_selection_matches_full_sort(self):
        features = ["x", "y"]
        history = [
            {"timestamp_ms": i * 10, "label_end_ms": i * 10 + 5,
             "x": float(i % 13), "y": float(i % 7)}
            for i in range(2000)
        ]
        current = {"x": 3.5, "y": 2.25}
        result = search_historical_analogs(
            current, history, features, asof_ms=20010, horizon_ms=20, k=30)
        from p3.historical_similarity import _vector
        eligible = [(row, _vector(row, features)) for row in history]
        means = [sum(v[j] for _, v in eligible) / len(eligible) for j in range(2)]
        scales = [max((sum((v[j] - means[j]) ** 2 for _, v in eligible)
                       / len(eligible)) ** .5, 1e-9) for j in range(2)]
        distances = []
        for row, v in eligible:
            distance = (sum(((v[j] - current[features[j]]) / scales[j]) ** 2
                            for j in range(2)) / 2) ** .5
            distances.append((distance, row["timestamp_ms"]))
        expected = sorted(distances)[:30]
        self.assertEqual([x["timestamp_ms"] for x in result],
                         [t for _, t in expected])
        for actual, (distance, _) in zip(result, expected):
            self.assertTrue(isclose(actual["distance"], distance, abs_tol=1e-12))


if __name__ == "__main__":
    unittest.main()
