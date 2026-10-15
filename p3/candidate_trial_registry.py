"""Append-only audit of validation-only candidate experiments.

No holdout fields or model activation columns exist in this registry.
"""
import os
from .multi_model_replay import STRATEGY_TIMEFRAMES


def record_candidate_trials(db, symbol, years, trials):
    run_id = os.getenv("GITHUB_RUN_ID")
    if not run_id:
        return {"recorded": False, "reason": "GITHUB_RUN_ID not configured"}
    rows = []
    for trial in trials:
        strategy = trial["strategy"]
        if strategy not in STRATEGY_TIMEFRAMES:
            raise ValueError("unknown strategy")
        begin, end = trial["validation_window"]
        rows.append({
            "trial_key": f"{run_id}:{symbol}:{strategy}:candidate",
            "source_run_key": f"{run_id}:{symbol}:{strategy}",
            "symbol": symbol,
            "strategy": strategy,
            "timeframe": STRATEGY_TIMEFRAMES[strategy],
            "lookback_years": years,
            "validation_start_ms": int(begin),
            "validation_end_ms": int(end),
            "params": trial["params"],
            "validation_score": trial["validation_score"],
            "validation_threshold": trial["selected_threshold"],
            "validation_eligible": bool(trial["validation_eligible"]),
            "status": ("VALIDATION_EVALUATED" if trial["validation_eligible"]
                       else "VALIDATION_REJECTED"),
            "report": {
                "validation_candidates": trial["validation_candidates"],
                "holdout_evaluated": False, "auto_promote": False,
                "paper_eligible": False,
            },
        })
    if not rows:
        return {"recorded": True, "count": 0}
    db("POST", "ai_candidate_trials", {"on_conflict": "trial_key"}, rows,
       {"Prefer": "resolution=ignore-duplicates,return=minimal"})
    return {"recorded": True, "count": len(rows)}


def claim_candidate_trials(db, symbol, years, trials):
    """Atomic per-window reservation via unique index and database RPC."""
    run_id = os.getenv("GITHUB_RUN_ID")
    if not run_id:
        return []
    claimed = []
    for trial in trials:
        strategy = trial["strategy"]
        begin, end = trial["validation_window"]
        key = f"{run_id}:{symbol}:{strategy}:candidate"
        result = db("POST", "rpc/claim_ai_candidate_trial", payload={
            "p_trial_key": key,
            "p_source_run_key": f"{run_id}:{symbol}:{strategy}",
            "p_symbol": symbol, "p_strategy": strategy,
            "p_timeframe": STRATEGY_TIMEFRAMES[strategy],
            "p_lookback_years": years,
            "p_validation_start_ms": int(begin),
            "p_validation_end_ms": int(end),
            "p_params": trial["params"],
        })
        if result is True:
            claimed.append(trial)
    return claimed


def finish_candidate_trial(db, symbol, trial, *, error=None):
    run_id = os.getenv("GITHUB_RUN_ID")
    if not run_id:
        raise RuntimeError("missing GITHUB_RUN_ID")
    status = ("FAILED" if error else
              ("VALIDATION_EVALUATED" if trial["validation_eligible"]
               else "VALIDATION_REJECTED"))
    result = db("POST", "rpc/finish_ai_candidate_trial", payload={
        "p_trial_key": f"{run_id}:{symbol}:{trial['strategy']}:candidate",
        "p_validation_score": trial.get("validation_score"),
        "p_validation_threshold": trial.get("selected_threshold"),
        "p_validation_eligible": bool(trial.get("validation_eligible", False)),
        "p_status": status,
        "p_report": {"validation_candidates": trial.get("validation_candidates", []),
                     "holdout_evaluated": False, "auto_promote": False,
                     "paper_eligible": False},
        "p_error_reason": str(error)[:500] if error else None,
    })
    if result is not True:
        raise RuntimeError("candidate claim not owned or already finalized")
