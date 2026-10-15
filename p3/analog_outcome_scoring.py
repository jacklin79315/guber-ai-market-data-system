"""Research-only historical analog outcome scoring. No order execution.

Outcomes are realized net R multiples from a PREDEFINED trade plan, not merely
future price direction. The caller must generate outcomes without future leakage.
"""
from math import isfinite, sqrt


def evaluate_analog_outcomes(neighbors, outcomes, *, min_samples=30,
                             min_net_expectancy_r=0.1, confidence_z=1.96,
                             max_sample_end_overlap_ms=0):
    """Evaluate selected neighbors using only fully realized, independent outcomes.

    outcomes maps timestamp_ms to {net_r, label_end_ms}. net_r already includes
    fees/slippage. To avoid treating clustered signals as independent samples,
    keep non-overlapping label intervals in chronological order.
    Conservative lower bound is mean - z*standard_error (descriptive, not a
    guarantee or a valid CI under all market dependencies).
    """
    if min_samples < 2 or min_net_expectancy_r < 0 or confidence_z < 0:
        raise ValueError("invalid scoring configuration")
    if max_sample_end_overlap_ms < 0:
        raise ValueError("negative overlap allowance")
    unique = {}
    for neighbor in neighbors:
        t = neighbor.get("timestamp_ms")
        end = neighbor.get("label_end_ms")
        if not isinstance(t, int) or not isinstance(end, int) or end <= t:
            continue
        item = outcomes.get(t)
        if not isinstance(item, dict) or item.get("label_end_ms") != end:
            continue
        net_r = item.get("net_r")
        if isinstance(net_r, bool) or not isinstance(net_r, (int, float)) or not isfinite(net_r):
            continue
        distance = neighbor.get("distance", float("inf"))
        if not isinstance(distance, (int, float)) or not isfinite(distance) or distance < 0:
            continue
        if t not in unique or distance < unique[t][0]:
            unique[t] = (distance, end, float(net_r))
    selected = []
    last_end = None
    for t, (distance, end, net_r) in sorted(unique.items()):
        if last_end is not None and t < last_end - max_sample_end_overlap_ms:
            continue
        selected.append((t, end, net_r))
        last_end = end
    n = len(selected)
    if not n:
        return {"decision": "WAIT", "reason": "no_eligible_outcomes",
                "sample_count": 0, "net_expectancy_r": None,
                "lower_bound_r": None, "win_rate": None}
    values = [x[2] for x in selected]
    mean = sum(values) / n
    win_rate = sum(x > 0 for x in values) / n
    variance = sum((x - mean) ** 2 for x in values) / (n - 1) if n > 1 else 0
    lower_bound = mean - confidence_z * sqrt(variance / n) if n > 1 else None
    enough = n >= min_samples
    decision = "CANDIDATE" if enough and lower_bound is not None and lower_bound > min_net_expectancy_r else "WAIT"
    reason = ("insufficient_independent_samples" if not enough else
              "positive_conservative_expectancy" if decision == "CANDIDATE" else
              "expectancy_not_robust")
    return {"decision": decision, "reason": reason, "sample_count": n,
            "net_expectancy_r": mean, "lower_bound_r": lower_bound,
            "win_rate": win_rate, "total_net_r": sum(values)}
