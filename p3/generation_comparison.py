"""Generation comparison is descriptive, never automatic model promotion."""
from .adaptive_trial_selection import validated_rank


def compare_generations(parent, child, *, parent_window, child_window):
    if not parent_window or not child_window:
        return {"status": "WAIT", "reason": "missing_windows"}
    if len(parent_window) != 2 or len(child_window) != 2:
        return {"status": "WAIT", "reason": "invalid_windows"}
    if child_window[0] <= parent_window[0] or child_window[1] <= parent_window[1]:
        return {"status": "WAIT", "reason": "window_not_advanced"}
    if not parent or not child:
        return {"status": "WAIT", "reason": "missing_generation"}
    def eligible(rows):
        return [r for r in rows if r.get("status") == "COMPLETE"
                and r.get("validation_eligible") is True
                and validated_rank(r) is not None]
    a, b = eligible(parent), eligible(child)
    if not a or not b:
        return {"status": "WAIT", "reason": "no_eligible_models",
                "parent_eligible": len(a), "child_eligible": len(b)}
    best_a = max(a, key=validated_rank)
    best_b = max(b, key=lambda r: float(r["validation_score"]))
    return {
        "status": "RESEARCH_COMPARISON_ONLY",
        "parent_best_validation_score": validated_rank(best_a),
        "child_best_validation_score": validated_rank(best_b),
        "raw_score_difference": float(best_b["validation_score"]) -
                                float(best_a["validation_score"]),
        "parent_eligible": len(a), "child_eligible": len(b),
        "is_apples_to_apples": False,
        "reason": "different_validation_windows_require_common_out_of_sample_evaluation",
        "model_promoted": False,
    }
