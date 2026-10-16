"""Approved, deterministic one-parameter-at-a-time research candidate generation.

Only eligible trade feedback can anchor new candidates. No holdout or live orders.
"""
import math
from .walk_forward_feedback import exploration_rank, diagnose_feedback_hypothesis

ITER_VALUES = (60, 80, 100, 120, 160, 200)
RATE_VALUES = (0.025, 0.05, 0.10)
LAYERS = ("direction", "structure")
DEFAULT_LAYER_PARAMS = {
    "direction_max_iter": 120, "direction_learning_rate": 0.10,
    "structure_max_iter": 120, "structure_learning_rate": 0.10,
}


def _valid_params(params):
    if not isinstance(params, dict) or set(params) != set(DEFAULT_LAYER_PARAMS):
        return False
    return (type(params["direction_max_iter"]) is int
            and params["direction_max_iter"] in ITER_VALUES
            and type(params["structure_max_iter"]) is int
            and params["structure_max_iter"] in ITER_VALUES
            and type(params["direction_learning_rate"]) is float
            and params["direction_learning_rate"] in RATE_VALUES
            and type(params["structure_learning_rate"]) is float
            and params["structure_learning_rate"] in RATE_VALUES)


def next_feedback_candidate(history):
    """Return a novel single-field candidate, or a reason to stop.

    Baseline trial must already have been run and contain separate-layer params.
    Direction loss hypothesis is evidence to test, not a causal conclusion.
    Structure layer exploration needs structure-specific evidence (not yet wired).
    """
    eligible = [row for row in history
                if exploration_rank(row.get("metrics") or {}) is not None
                and _valid_params(row.get("params"))]
    if not eligible:
        return {"status": "NO_ELIGIBLE_FEEDBACK", "candidate": None}
    best = max(eligible, key=lambda row: exploration_rank(row["metrics"]))
    evidence = best.get("direction_prediction_diagnostics")
    if not isinstance(evidence, dict):
        return {"status": "MISSING_DIRECTION_PREDICTION_EVIDENCE", "candidate": None}
    count = evidence.get("matched_predictions")
    error = evidence.get("direction_error_rate_percent")
    if (type(count) is not int or count < 5
            or type(error) not in (int, float) or not math.isfinite(error)
            or not 0 <= error <= 100):
        return {"status": "INSUFFICIENT_DIRECTION_PREDICTION_EVIDENCE", "candidate": None}
    hypothesis = {"status": "DIRECTION_HYPOTHESIS_ONLY",
                  "source_trial_index": best.get("trial_index"),
                  "matched_predictions": count, "direction_error_rate_percent": error,
                  "limitations": "Forecast errors do not prove a parameter change will improve trades."}
    anchor = best["params"]
    seen = {tuple(sorted(row["params"].items())) for row in history
            if _valid_params(row.get("params"))}
    # Approved exploration grid, one changed field, deterministic and auditable.
    for field, values in (("direction_max_iter", ITER_VALUES),
                          ("direction_learning_rate", RATE_VALUES)):
        for value in sorted(values, key=lambda v: (abs(v - anchor[field]), v)):
            if value == anchor[field]:
                continue
            candidate = dict(anchor, **{field: value})
            if tuple(sorted(candidate.items())) not in seen:
                return {"status": "CANDIDATE_READY", "candidate": candidate,
                        "changed_field": field, "old_value": anchor[field],
                        "new_value": value, "target_layer": "DIRECTION",
                        "source_trial_index": best.get("trial_index"),
                        "hypothesis": hypothesis,
                        "eligible_for_promotion": False}
    return {"status": "APPROVED_NEIGHBORHOOD_EXHAUSTED",
            "candidate": None, "source_trial_index": best.get("trial_index")}



def diagnose_structure_evidence(history):
    """Require actual price-range prediction error, not merely stop exits.

    Stop events describe execution outcomes and cannot distinguish a bad
    forecast from a valid forecast stopped by the market path.
    """
    eligible = [row for row in history
                if feedback_rank(row.get("metrics") or {}) is not None
                and _valid_params(row.get("params"))]
    if not eligible:
        return {"status": "NO_ELIGIBLE_FEEDBACK"}
    best = max(eligible, key=lambda row: feedback_rank(row["metrics"]))
    evidence = best.get("structure_prediction_diagnostics")
    if not isinstance(evidence, dict):
        return {"status": "MISSING_STRUCTURE_PREDICTION_EVIDENCE",
                "source_trial_index": best.get("trial_index"),
                "limitations": "Stop-loss events do not measure price-range forecast error."}
    count = evidence.get("matched_predictions")
    error = evidence.get("mean_absolute_range_error")
    if (type(count) is not int or count < 5
            or type(error) not in (int, float)
            or not math.isfinite(error) or error < 0):
        return {"status": "INSUFFICIENT_STRUCTURE_PREDICTION_EVIDENCE",
                "source_trial_index": best.get("trial_index")}
    return {"status": "STRUCTURE_HYPOTHESIS_ONLY",
            "source_trial_index": best.get("trial_index"),
            "matched_predictions": count,
            "mean_absolute_range_error": error,
            "hypothesis": "REVIEW_PREDICTED_PRICE_RANGES",
            "limitations": "Forecast error is descriptive, not proof that retuning improves trades."}


def next_structure_candidate(history):
    """Use eligible stop-exit evidence to propose a structure-only experiment."""
    hypothesis = diagnose_structure_evidence(history)
    if hypothesis["status"] != "STRUCTURE_HYPOTHESIS_ONLY":
        return {"status": hypothesis["status"], "candidate": None}
    anchor_row = next(row for row in history
                      if row.get("trial_index") == hypothesis["source_trial_index"])
    anchor = anchor_row["params"]
    seen = {tuple(sorted(row["params"].items())) for row in history
            if _valid_params(row.get("params"))}
    for field, values in (("structure_max_iter", ITER_VALUES),
                          ("structure_learning_rate", RATE_VALUES)):
        for value in sorted(values, key=lambda v: (abs(v - anchor[field]), v)):
            if value == anchor[field]:
                continue
            candidate = dict(anchor, **{field: value})
            if tuple(sorted(candidate.items())) not in seen:
                return {"status": "CANDIDATE_READY", "candidate": candidate,
                        "changed_field": field, "old_value": anchor[field],
                        "new_value": value, "target_layer": "STRUCTURE",
                        "source_trial_index": hypothesis["source_trial_index"],
                        "hypothesis": hypothesis,
                        "eligible_for_promotion": False}
    return {"status": "APPROVED_NEIGHBORHOOD_EXHAUSTED", "candidate": None}
