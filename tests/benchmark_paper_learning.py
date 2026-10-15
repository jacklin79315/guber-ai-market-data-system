"""Reproducible CPU benchmark for the paper-only chronological Ridge learner.

Run: python -m tests.benchmark_paper_learning
No database access, orders, or persisted model.
"""
import json
from statistics import median
from time import perf_counter
from p3.paper_learning import chronological_paper_learning


def synthetic_records(n):
    records = []
    for i in range(n):
        for direction in ("LONG", "SHORT"):
            records.append({
                "signal_time_ms": i * 900000,
                "label_end_ms": (i + 2) * 900000 - 1,
                "direction": direction,
                "signal_features": {
                    "x": (i % 101) / 101.0,
                    "y": (i % 37) / 37.0,
                    "z": (i % 19) / 19.0,
                },
                "net_r": ((i * 13) % 29 - 14) / 10.0
                * (1 if direction == "LONG" else -1),
            })
    return records


def benchmark(sample_count, evaluation_count=40, repeats=3):
    records = synthetic_records(sample_count)
    durations = []
    output = None
    evaluation_start_ms = (sample_count - evaluation_count) * 900000
    for _ in range(repeats):
        started = perf_counter()
        output = chronological_paper_learning(
            records, ["x", "y", "z"], min_train=10,
            evaluation_start_ms=evaluation_start_ms)
        durations.append(perf_counter() - started)
    return {
        "sample_timestamps": sample_count,
        "training_records": len(records),
        "evaluation_timestamps": evaluation_count,
        "prediction_count": output["prediction_count"],
        "elapsed_seconds_median": round(median(durations), 4),
        "repeats": repeats,
        "research_only": True,
    }


if __name__ == "__main__":
    print(json.dumps({
        "benchmark": "chronological_ridge_cpu_v1",
        "results": [benchmark(n) for n in (500, 2500, 10000)],
        "note": "Synthetic benchmark, not 3-year live database throughput.",
    }, sort_keys=True))
