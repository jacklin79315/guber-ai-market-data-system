"""Sequential trial selection using prior completed outcomes, not a static trial order.

Only validation-eligible completed trials guide the next candidate. When there
is no usable feedback, explore the remaining grid deterministically.
"""
def next_candidate(candidates, trials):
    seen = {tuple(sorted(t["params"].items())) for t in trials}
    remaining = [p for p in candidates if tuple(sorted(p.items())) not in seen]
    if not remaining:
        return None
    eligible = [t for t in trials if t.get("status") == "COMPLETE"
                and t.get("validation_eligible") is True
                and t.get("validation_score") is not None]
    if not eligible:
        return remaining[0]
    best = max(eligible, key=lambda t: float(t["validation_score"]))
    anchor = best["params"]
    return min(remaining, key=lambda p: (
        abs(p["max_iter"] - anchor["max_iter"]) / 100
        + abs(p["learning_rate"] - anchor["learning_rate"]) / 0.05,
        p["max_iter"], p["learning_rate"]))
