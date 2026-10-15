"""Versioned research evaluation ledger, not a live PnL record."""
import hashlib
import json
from .paper_outcome_memory import PLAN_VERSION, DATA_VERSION


def save_paper_evaluation(db, *, symbol, strategy, timeframe,
                          evaluation_start_ms, evaluation_end_ms,
                          learning, decisions):
    if evaluation_end_ms < evaluation_start_ms:
        raise ValueError("invalid evaluation window")
    identity = [symbol, strategy, timeframe, PLAN_VERSION, DATA_VERSION,
                learning["model"], evaluation_start_ms, evaluation_end_ms]
    run_key = hashlib.sha256(json.dumps(identity).encode()).hexdigest()
    row = {
        "run_key": run_key, "symbol": symbol, "strategy": strategy,
        "timeframe": timeframe, "model_name": learning["model"],
        "plan_version": PLAN_VERSION, "data_version": DATA_VERSION,
        "evaluation_start_ms": evaluation_start_ms,
        "evaluation_end_ms": evaluation_end_ms,
        "training_observations": learning["available_training_observation_count"],
        "prediction_count": learning["prediction_count"],
        "selected_trades": decisions["realized_selected_count"],
        "total_net_r": decisions["realized_total_net_r"],
        "model_mae_r": learning["mean_absolute_error_r"],
        "baseline_mae_r": learning["baseline_mean_absolute_error_r"],
        "report": {"learning": {k: v for k, v in learning.items()
                                if k != "predictions"},
                   "decisions": {k: v for k, v in decisions.items()
                                 if k != "decisions"},
                   "research_only": True, "auto_trade_enabled": False},
    }
    db("POST", "ai_paper_evaluations", params={"on_conflict": "run_key"},
       payload=[row], extra={"Prefer": "resolution=ignore-duplicates,return=minimal"})
    return run_key


def compare_paper_evaluations(db, *, symbol, strategy, limit=20):
    """Read versioned evaluations without treating repeated windows as new evidence."""
    if not 1 <= limit <= 100:
        raise ValueError("invalid evaluation history limit")
    rows = db("GET", "ai_paper_evaluations", params={
        "select": "run_key,model_name,plan_version,data_version,evaluation_start_ms,evaluation_end_ms,training_observations,prediction_count,selected_trades,total_net_r,model_mae_r,baseline_mae_r,created_at",
        "symbol": "eq." + symbol, "strategy": "eq." + strategy,
        "order": "created_at.desc", "limit": str(limit),
    })
    result = []
    # Select only mutually non-overlapping windows, newest first.
    selected_windows = []
    for row in rows:
        comparable = (row["plan_version"] == PLAN_VERSION
                      and row["data_version"] == DATA_VERSION)
        mae = row["model_mae_r"]
        baseline = row["baseline_mae_r"]
        trades = row["selected_trades"]
        start, end = int(row["evaluation_start_ms"]), int(row["evaluation_end_ms"])
        independent = not any(start <= prior_end and prior_start <= end
                              for prior_start, prior_end in selected_windows)
        if independent and comparable:
            selected_windows.append((start, end))
        result.append({**row,
            "independent_evaluation_window": independent and comparable,
            "version_comparable": comparable,
            "mae_beats_baseline": (float(mae) < float(baseline)
                                   if mae is not None and baseline is not None else None),
            "trading_evidence_sufficient": trades >= 30,
            "eligible_for_promotion": False,
            "warning": "historical research only; overlapping windows are not independent"})
    return result
