"""Approved, deterministic one-parameter-at-a-time research candidate generation.

Only eligible trade feedback can anchor new candidates. No holdout or live orders.
"""
from .walk_forward_feedback import feedback_rank, diagnose_feedback_hypothesis

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
                if feedback_rank(row.get("metrics") or {}) is not None
                and _valid_params(row.get("params"))]
    if not eligible:
        return {"status": "NO_ELIGIBLE_FEEDBACK", "candidate": None}
    hypothesis = diagnose_feedback_hypothesis(eligible)
    if hypothesis["status"] != "TESTABLE_HYPOTHESIS_ONLY":
        return {"status": hypothesis["status"], "candidate": None}
    best = max(eligible, key=lambda row: feedback_rank(row["metrics"]))
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
