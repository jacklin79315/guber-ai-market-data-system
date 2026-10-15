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
