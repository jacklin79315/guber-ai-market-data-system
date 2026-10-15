"""Leakage-safe historical feature similarity research (no trading actions).

Feature vectors must contain information available at the decision timestamp.
Outcome labels are used only AFTER neighbours are selected, never for similarity.
"""
from math import isfinite, sqrt
from heapq import nsmallest


def _vector(row, features):
    values = []
    for key in features:
        value = row.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
            return None
        values.append(float(value))
    return values


def search_historical_analogs(current, history, features, *, asof_ms,
                              horizon_ms, embargo_ms=0, k=30, min_distance_scale=1e-9):
    """Return closest eligible past observations, excluding unobserved outcomes.

    Each history row has timestamp_ms, label_end_ms and features. An eligible
    label must be fully observable before asof_ms minus embargo_ms.
    All scaling uses eligible history ONLY. Never compare future rows.
    """
    if not features or k < 1 or horizon_ms <= 0 or embargo_ms < 0:
        raise ValueError("invalid search configuration")
    query = _vector(current, features)
    if query is None:
        raise ValueError("current feature vector is incomplete")
    eligible = []
    cutoff = asof_ms - embargo_ms
    for row in history:
        t, end = row.get("timestamp_ms"), row.get("label_end_ms")
        if not isinstance(t, int) or not isinstance(end, int):
            continue
        if t >= asof_ms or end > cutoff or end < t or end - t > horizon_ms:
            continue
        vector = _vector(row, features)
        if vector is not None:
            eligible.append((row, vector))
    if not eligible:
        return []
    # Feature scaling prevents e.g. price-sized values overwhelming RSI.
    n = len(features)
    means = [sum(v[j] for _, v in eligible) / len(eligible) for j in range(n)]
    scales = [
        max(sqrt(sum((v[j] - means[j]) ** 2 for _, v in eligible) / len(eligible)),
            min_distance_scale)
        for j in range(n)
    ]
    ranked = []
    for row, vector in eligible:
        distance = sqrt(sum(((vector[j] - query[j]) / scales[j]) ** 2
                            for j in range(n)) / n)
        ranked.append({"timestamp_ms": row["timestamp_ms"],
                       "label_end_ms": row["label_end_ms"],
                       "distance": distance})
    # Select only the k nearest rows without sorting the entire history.
    # Identical distance/timestamp tie-breaking preserves prior semantics.
    return nsmallest(k, ranked, key=lambda x: (x["distance"], x["timestamp_ms"]))
