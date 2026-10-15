"""Determine whether the next research generation is permitted to run.

No new fully-formed validation window -> WAIT, never repeat old tuning.
The schedule is advisory; no automatic model activation or live orders.
"""
from datetime import datetime, timezone


def generation_readiness(*, latest_run_complete, current_window,
                         previous_window, parent_eligible, already_evaluated,
                         max_generations=None, next_generation=2):
    if not latest_run_complete:
        return {"status": "WAIT", "reason": "parent_run_incomplete"}
    if next_generation < 2 or (max_generations is not None and next_generation > max_generations):
        return {"status": "WAIT", "reason": "generation_limit"}
    if not parent_eligible:
        return {"status": "WAIT", "reason": "no_eligible_parent"}
    if already_evaluated:
        return {"status": "WAIT", "reason": "validation_window_already_evaluated"}
    if not isinstance(current_window, (list, tuple)) or not isinstance(previous_window, (list, tuple)):
        return {"status": "WAIT", "reason": "missing_validation_window"}
    if len(current_window) != 2 or len(previous_window) != 2:
        return {"status": "WAIT", "reason": "invalid_validation_window"}
    if not all(isinstance(t, int) for t in (*current_window, *previous_window)):
        return {"status": "WAIT", "reason": "invalid_validation_window"}
    if current_window[0] <= previous_window[0] or current_window[1] <= previous_window[1]:
        return {"status": "WAIT", "reason": "validation_window_not_advanced"}
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    if current_window[1] > now_ms:
        return {"status": "WAIT", "reason": "future_validation_data"}
    return {"status": "READY", "reason": "fresh_window_available",
            "generation": next_generation, "auto_promote": False,
            "live_trading": False}
