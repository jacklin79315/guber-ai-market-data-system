"""Append-only training audit records. Holdout metrics are audit-only, never promotion criteria."""
import os
from .experiment_history import compare_experiment_history

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
        provenance = report.get("provenance") or {}
        comparison_context = {
            "validation_window": report.get("validation_window"),
            "evaluation_version": "p3-validation-v1",
            "dataset_version": provenance.get("dataset_version"),
            "feature_version": provenance.get("feature_version") if provenance.get("code_version") else None,
            "fee_version": provenance.get("fee_version"),
            "code_version": provenance.get("code_version"),
        }
        rows.append({
            "run_key": f"{run_id}:{symbol}:{strategy}",
            "symbol": symbol, "strategy": strategy,
            "timeframe": report["timeframe"], "lookback_years": years,
            "validation_threshold": threshold,
            "validation_score": (winner["return_percent"] - winner["drawdown_percent"]) if winner else None,
            "validation_trades": winner["closed_trades"] if winner else None,
            "validation_eligible": report.get("qualification", {}).get("validation_eligible", winner is not None),
            "holdout_return_percent": 100 * (report["final_equity"] / 10000 - 1),
            "holdout_drawdown_percent": report["max_close_to_close_drawdown_percent"],
            "holdout_trades": report["closed_trades"],
            "holdout_uncertain": report["execution_path_uncertain"],
            "paper_eligible": report.get("qualification", {}).get("paper_eligible", False),
            "report": {**report, "comparison_context": comparison_context,
                       "promotion_decision": "NOT_EVALUATED"},
        })
    # Read historical rows before insertion so the audit can be persisted
    # atomically in each append-only training record.
    # Pagination avoids silently comparing against only the newest 1000 rows.
    history = []
    offset = 0
    while True:
        page = db("GET", "ai_training_runs", {
            "select": "run_key,symbol,strategy,timeframe,lookback_years,report",
            "symbol": "eq." + symbol,
            "order": "run_key.desc",
            "limit": "500",
            "offset": str(offset),
        })
        history.extend(page)
        if len(page) < 500:
            break
        offset += len(page)
    audits = {}
    for row in rows:
        audit = compare_experiment_history(row, history)
        audits[row["strategy"]] = audit
        row["report"]["experiment_history"] = audit
    db("POST", "ai_training_runs", {"on_conflict": "run_key"}, rows,
       {"Prefer": "resolution=ignore-duplicates,return=minimal"})
    # Persisted audits are immutable; no model is activated.
    return {"recorded": True, "count": len(rows),
            "history_rows": len(history), "experiment_history": audits}
