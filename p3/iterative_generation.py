"""Bounded next-generation parameter proposals; validation data never becomes training labels.

Each generation uses previous validation scores only to propose nearby candidates.
Repeated use of the same validation window is explicitly blocked to prevent
claiming artificial progress from repeated hyperparameter search.
"""
import itertools
from .adaptive_trial_selection import validated_rank

ITERATIONS = (40, 60, 80, 100, 120, 140, 180, 220, 260, 300)
RATES = (0.015, 0.025, 0.035, 0.05, 0.065, 0.075, 0.1, 0.125, 0.15, 0.175)
MAX_TRIALS = 25


def _key(params):
    return (int(params["max_iter"]), float(params["learning_rate"]))


def propose_generation(history, *, current_validation_window,
                       previous_validation_window, limit=MAX_TRIALS):
    """Return WAIT or a deterministic new generation; never use holdout scores.

    history: validation-only trial rows from ONE strategy and ONE prior generation.
    An unchanged validation window cannot authorize another round.
    """
    if not current_validation_window or not previous_validation_window:
        return {"status": "WAIT", "reason": "missing_validation_window", "candidates": []}
    if tuple(current_validation_window) == tuple(previous_validation_window):
        return {"status": "WAIT", "reason": "validation_window_unchanged", "candidates": []}
    if not 1 <= limit <= MAX_TRIALS:
        raise ValueError("invalid generation size")
    evaluated = [row for row in history
                 if row.get("status") == "COMPLETE"
                 and row.get("validation_eligible") is True
                 and validated_rank(row) is not None
                 and isinstance(row.get("params"), dict)]
    if not evaluated:
        return {"status": "WAIT", "reason": "no_eligible_parent", "candidates": []}
    parents = sorted(evaluated, key=lambda row: (
        tuple(-v for v in validated_rank(row)), int(row.get("trial_index", 0))))[:5]
    seen = {_key(row["params"]) for row in history if isinstance(row.get("params"), dict)
            and set(row["params"]) >= {"max_iter", "learning_rate"}}
    proposals = []
    for parent in parents:
        iterations, rate = _key(parent["params"])
        candidates = sorted(itertools.product(ITERATIONS, RATES),
                            key=lambda p: (abs(p[0] - iterations) / 100 +
                                           abs(p[1] - rate) / 0.05, p[0], p[1]))
        for candidate in candidates[:30]:
            if candidate not in seen and candidate not in proposals:
                proposals.append(candidate)
                break
    all_candidates = sorted(itertools.product(ITERATIONS, RATES),
                            key=lambda p: (min(
                                abs(p[0] - _key(parent["params"])[0]) / 100 +
                                abs(p[1] - _key(parent["params"])[1]) / 0.05
                                for parent in parents), p[0], p[1]))
    for candidate in all_candidates:
        if len(proposals) >= limit:
            break
        if candidate not in seen and candidate not in proposals:
            proposals.append(candidate)
    if not proposals:
        return {"status": "WAIT", "reason": "search_space_exhausted", "candidates": []}
    return {"status": "READY", "reason": "new_validation_window",
            "candidates": [{"max_iter": n, "learning_rate": r}
                           for n, r in proposals[:limit]],
            "parent_count": len(parents), "auto_promote": False,
            "holdout_used_for_selection": False}
