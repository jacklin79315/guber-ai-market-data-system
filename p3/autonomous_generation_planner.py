"""Deterministic, side-effect-free next-generation planning.

The scheduler may call this repeatedly; no candidate is launched without a
new closed evaluation window and an eligible, fully recorded parent.
"""
from .generation_readiness import generation_readiness


def plan_next_generation(*, parent_run_id, parent_generation, parent_trials,
                         previous_window, current_window, existing_windows,
                         maximum_generations=10):
    if not parent_run_id or not isinstance(parent_generation, int):
        return {"status": "WAIT", "reason": "missing_parent_lineage"}
    if not isinstance(parent_trials, list) or len(parent_trials) != 25:
        return {"status": "WAIT", "reason": "parent_trial_count_incomplete"}
    if not isinstance(previous_window, (tuple, list)) or len(previous_window) != 2:
        return {"status": "WAIT", "reason": "missing_parent_window"}
    if any(row.get("validation_start_ms") != previous_window[0] or
           row.get("validation_end_ms") != previous_window[1] for row in parent_trials):
        return {"status": "WAIT", "reason": "parent_window_unverified"}
    if len({row.get("trial_index") for row in parent_trials}) != 25:
        return {"status": "WAIT", "reason": "duplicate_parent_trial"}
    next_generation = parent_generation + 1
    readiness = generation_readiness(
        latest_run_complete=all(row.get("status") == "COMPLETE" for row in parent_trials),
        current_window=current_window,
        previous_window=previous_window,
        parent_eligible=any(row.get("validation_eligible") is True for row in parent_trials),
        already_evaluated=tuple(current_window) in {tuple(w) for w in existing_windows},
        max_generations=maximum_generations,
        next_generation=next_generation,
    )
    if readiness["status"] != "READY":
        return readiness
    return {**readiness, "parent_run_id": parent_run_id,
            "parent_validation_window": list(previous_window),
            "current_validation_window": list(current_window),
            "candidate_budget_per_strategy": 25,
            "requires_atomic_claim": True}
