"""Read-only autonomous experiment scheduler: never train or promote from stale validation."""
from .experiment_history import authorize_next_validation


def plan_next_experiment(history, current_validation_windows):
    """Return per-strategy WAIT/READY decisions using saved Supabase audits.

    history: ai_training_runs rows sorted newest first, each with report JSON.
    current_validation_windows: mapping strategy -> [start_ms, end_ms]
    READY only permits a future candidate trial, not model promotion.
    """
    latest = {}
    for row in history:
        strategy = row.get("strategy")
        if strategy and strategy not in latest:
            latest[strategy] = row
    result = {}
    for strategy, row in latest.items():
        report = row.get("report") or {}
        audit = report.get("experiment_history") or {}
        previous = (report.get("comparison_context") or {}).get("validation_window")
        current = current_validation_windows.get(strategy)
        decision = authorize_next_validation(audit, previous, current)
        result[strategy] = {
            "status": "READY" if decision["authorized"] else "WAIT",
            "reason": decision["reason"],
            "params": decision.get("params") if decision["authorized"] else None,
            "previous_validation_window": previous,
            "current_validation_window": current,
            "auto_promote": False,
            "allow_holdout_selection": False,
        }
    return result
