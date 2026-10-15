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
