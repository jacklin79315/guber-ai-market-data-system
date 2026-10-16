"""Opt-in approved research loop; baseline + up to 10 feedback candidates.

No persistence, scheduling, independent holdout, or model promotion.
"""
from .autonomous_experiment_plan import (
    research_data_fingerprint, compare_iteration_records, assess_candidate_research)
from .feedback_candidate_generator import (
    DEFAULT_LAYER_PARAMS, next_feedback_candidate, next_structure_candidate)
from .walk_forward_feedback import (
    replay_walk_forward_research, feedback_rank, diagnose_feedback_hypothesis)


def run_feedback_candidate_research(candles, features, strategy, research, *,
                                    symbol, fee_rate, slippage_rate,
                                    max_new_candidates=10, target_layer="DIRECTION"):
    if type(max_new_candidates) is not int or not 1 <= max_new_candidates <= 10:
        raise ValueError("approved candidate budget is 1..10")
    if not symbol:
        raise ValueError("symbol required")
    if target_layer not in ("DIRECTION", "STRUCTURE"):
        raise ValueError("invalid target_layer")
    fingerprint = research_data_fingerprint(candles, features, research)
    history = []
    stop_reason = None
    for index in range(max_new_candidates + 1):
        if index == 0:
            params = dict(DEFAULT_LAYER_PARAMS)
            selection = {"status": "BASELINE"}
        else:
            if (history[-1].get("research_evidence_status") or {}).get("status") != "EVIDENCE_READY_FOR_COMPARATIVE_RESEARCH":
                stop_reason = "WAIT_FOR_MODEL_EVIDENCE"
                break
            if (history[-1].get("research_candidate_assessment") or {}).get("status") == "WAIT":
                stop_reason = "WAIT_FOR_RESEARCH_EVIDENCE"
                break
            selection = (next_feedback_candidate(history) if target_layer == "DIRECTION"
                         else next_structure_candidate(history))
            params = selection["candidate"]
            if params is None:
                stop_reason = selection["status"]
                break
        result = replay_walk_forward_research(
            candles, features, strategy, research, params=params,
            fee_rate=fee_rate, slippage_rate=slippage_rate, symbol=symbol)
        metrics = result["research_trading_metrics"]
        row = {
            "trial_index": index + 1, "params": params, "metrics": metrics,
            "strategy": strategy, "research_window": list(research),
            "symbol": symbol, "fee_rate": fee_rate,
            "slippage_rate": slippage_rate, "data_fingerprint": fingerprint,
            "selection": selection,
            "eligible_trade_diagnosis": result.get("eligible_trade_diagnosis"),
            "structure_prediction_diagnostics": result.get("structure_prediction_diagnostics"),
            "direction_prediction_diagnostics": result.get("direction_prediction_diagnostics"),
            "prediction_coverage_audit": result.get("prediction_coverage_audit"),
            "research_evidence_status": result.get("research_evidence_status"),
            "drawdown_failure_diagnosis": result.get("drawdown_failure_diagnosis"),
            "checkpoints": result["training_checkpoints"],
            "feedback_rank": feedback_rank(metrics),
            "eligible_for_promotion": False,
        }
        if index:
            anchor = next((h for h in history
                           if h["trial_index"] == selection["source_trial_index"]),
                          None)
            if anchor is None:
                raise ValueError("missing comparison anchor")
            row["paired_research_comparison"] = compare_iteration_records(anchor, row)
            row["research_candidate_assessment"] = assess_candidate_research(anchor, row)
        else:
            row["paired_research_comparison"] = None
            row["research_candidate_assessment"] = None
        history.append(row)
    return {
        "strategy": strategy, "research_window": list(research),
        "target_layer": target_layer, "iterations": history, "new_candidates_run": max(0, len(history) - 1),
        "stop_reason": stop_reason or "APPROVED_BATCH_BUDGET_REACHED",
        "next_action": ("WAIT_FOR_EVIDENCE" if (stop_reason or "").startswith("WAIT_")
                        else "REVIEW_RESEARCH_RESULTS"),
        "research_summary": {
            "baseline_trials": 1 if history else 0,
            "candidate_trials": max(0, len(history) - 1),
            "improved_in_research": sum(
                (item.get("research_candidate_assessment") or {}).get("status")
                == "IMPROVED_IN_RESEARCH_ONLY" for item in history),
            "rejected_in_research": sum(
                (item.get("research_candidate_assessment") or {}).get("status")
                == "REJECTED_IN_RESEARCH" for item in history),
            "inconclusive_candidates": sum(
                (item.get("research_candidate_assessment") or {}).get("status")
                == "WAIT" for item in history),
        },
        "latest_hypothesis": diagnose_feedback_hypothesis(history),
        "decision_log": [
            {"trial_index": item["trial_index"],
             "selection_status": item["selection"]["status"],
             "assessment_status": (item["research_candidate_assessment"] or {}).get("status"),
             "feedback_eligible": item["feedback_rank"] is not None,
             "eligible_for_promotion": False}
            for item in history],
        "independent_validation_performed": False,
        "eligible_for_promotion": False,
    }
