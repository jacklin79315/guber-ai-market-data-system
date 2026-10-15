"""Append-only training audit records. Holdout metrics are audit-only, never promotion criteria."""
import os

def record_training_reports(db, symbol, years, reports):
    run_id = os.getenv("GITHUB_RUN_ID")
    if not run_id:
        return {"recorded": False, "reason": "GITHUB_RUN_ID not configured"}
    rows = []
    for strategy, report in reports.items():
        selection = report["validation_selection"]
        threshold = selection["selected_threshold"]
        candidates = selection["candidates"]
        winner = next((c for c in candidates if c["threshold"] == threshold), None)
        rows.append({
            "run_key": f"{run_id}:{symbol}:{strategy}",
            "symbol": symbol, "strategy": strategy,
            "timeframe": report["timeframe"], "lookback_years": years,
            "validation_threshold": threshold,
            "validation_score": (winner["return_percent"] - winner["drawdown_percent"]) if winner else None,
            "validation_trades": winner["closed_trades"] if winner else None,
            "validation_eligible": winner is not None,
            "holdout_return_percent": 100 * (report["final_equity"] / 10000 - 1),
            "holdout_drawdown_percent": report["max_close_to_close_drawdown_percent"],
            "holdout_trades": report["closed_trades"],
            "holdout_uncertain": report["execution_path_uncertain"],
            "paper_eligible": report["model_eligible_for_paper"],
            "report": report,
        })
    db("POST", "ai_training_runs", {"on_conflict": "run_key"}, rows,
       {"Prefer": "resolution=ignore-duplicates,return=minimal"})
    return {"recorded": True, "count": len(rows)}
