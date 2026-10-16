"""Audit-only experiment plans and paired research comparisons.

This module does not generate parameter candidates, fit models, touch holdout,
or promote a model. Candidate-generation bounds require separate approval.
"""
from math import isfinite


def propose_experiment(hypothesis):
    """Translate a grounded diagnosis into a proposal requiring authorization."""
    if not isinstance(hypothesis, dict):
        raise ValueError("hypothesis must be a dict")
    status = hypothesis.get("status")
    if status != "TESTABLE_HYPOTHESIS_ONLY":
        return {"status": "BLOCKED_NO_TESTABLE_HYPOTHESIS",
                "source_trial_index": hypothesis.get("source_trial_index"),
                "candidate_params": None, "requires_approval": True}
    name = hypothesis.get("hypothesis")
    if name not in ("REVIEW_DIRECTION_OUTCOMES_LONG",
                    "REVIEW_DIRECTION_OUTCOMES_SHORT"):
        return {"status": "BLOCKED_UNSUPPORTED_HYPOTHESIS",
                "source_trial_index": hypothesis.get("source_trial_index"),
                "candidate_params": None, "requires_approval": True}
    return {
        "status": "AWAITING_CANDIDATE_GENERATION_APPROVAL",
        "source_trial_index": hypothesis.get("source_trial_index"),
        "hypothesis": name,
        "evidence": hypothesis.get("evidence"),
        "target_layer": "DIRECTION",
        "test_design": ("Compare an approved direction-layer candidate with the "
                        "unchanged baseline on the same research window; "
                        "evaluate risk and trade counts before independent validation."),
        "candidate_params": None,
        "requires_approval": True,
        "eligible_for_promotion": False,
    }


def compare_research_trials(baseline, candidate):
    """Compare like-for-like research results without promoting or tuning holdout."""
    keys = ("annualized_return_percent", "win_rate_percent",
            "mean_score_q", "max_close_to_close_drawdown_percent")
    if not isinstance(baseline, dict) or not isinstance(candidate, dict):
        raise ValueError("metrics must be dictionaries")
    delta = {}
    for key in keys:
        a, b = baseline.get(key), candidate.get(key)
        delta[key] = (b - a if type(a) in (int, float)
                      and type(b) in (int, float)
                      and isfinite(a) and isfinite(b) else None)
    from .walk_forward_feedback import feedback_rank
    a_rank, b_rank = feedback_rank(baseline), feedback_rank(candidate)
    return {
        "status": ("RESEARCH_COMPARABLE" if a_rank is not None and b_rank is not None
                   else "NOT_COMPARABLE_UNDER_FEEDBACK_RULES"),
        "baseline_feedback_eligible": a_rank is not None,
        "candidate_feedback_eligible": b_rank is not None,
        "metric_deltas_candidate_minus_baseline": delta,
        "candidate_better_in_research": (b_rank > a_rank
                                         if a_rank is not None and b_rank is not None
                                         else None),
        "independent_validation_performed": False,
        "eligible_for_promotion": False,
    }


def compare_iteration_records(baseline, candidate):
    """Reject mismatched research contexts before any metric comparison.

    Same strategy/window is necessary but not sufficient: symbol, fees,
    slippage, and data fingerprints must also be explicitly equal.
    """
    if not isinstance(baseline, dict) or not isinstance(candidate, dict):
        raise ValueError("iteration records must be dictionaries")
    required = ("strategy", "research_window", "symbol", "fee_rate",
                "slippage_rate", "data_fingerprint")
    missing = [key for key in required
               if key not in baseline or key not in candidate
               or baseline[key] is None or candidate[key] is None]
    if missing:
        return {"status": "BLOCKED_MISSING_COMPARISON_CONTEXT",
                "missing_context": missing,
                "candidate_better_in_research": None,
                "independent_validation_performed": False,
                "eligible_for_promotion": False}
    mismatched = [key for key in required if baseline[key] != candidate[key]]
    if mismatched:
        return {"status": "BLOCKED_MISMATCHED_COMPARISON_CONTEXT",
                "mismatched_context": mismatched,
                "candidate_better_in_research": None,
                "independent_validation_performed": False,
                "eligible_for_promotion": False}
    result = compare_research_trials(baseline.get("metrics"),
                                     candidate.get("metrics"))
    result["comparison_context_verified"] = True
    return result
