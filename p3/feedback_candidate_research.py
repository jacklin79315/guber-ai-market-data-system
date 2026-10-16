"""Opt-in approved research loop; baseline + up to 10 feedback candidates.

No persistence, scheduling, independent holdout, or model promotion.
"""
from .autonomous_experiment_plan import (
    research_data_fingerprint, compare_iteration_records)
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
        else:
            row["paired_research_comparison"] = None
        history.append(row)
    return {
        "strategy": strategy, "research_window": list(research),
        "target_layer": target_layer, "iterations": history, "new_candidates_run": max(0, len(history) - 1),
        "stop_reason": stop_reason or "APPROVED_BATCH_BUDGET_REACHED",
        "latest_hypothesis": diagnose_feedback_hypothesis(history),
        "independent_validation_performed": False,
        "eligible_for_promotion": False,
    }
