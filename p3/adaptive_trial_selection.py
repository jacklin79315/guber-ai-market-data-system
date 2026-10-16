"""Sequential trial selection using prior completed outcomes, not a static trial order.

Only validation-eligible completed trials guide the next candidate. When there
is no usable feedback, explore the remaining grid deterministically.
"""
import math


def validated_rank(trial):
    """Only completed, eligible, finite validation trading results can guide learning."""
    keys = ("validation_annualized_return_percent", "validation_win_rate_percent", "validation_mean_score_q")
    values = [trial.get(key) for key in keys]
    dd = trial.get("validation_drawdown_percent")
    if (trial.get("status") != "COMPLETE" or trial.get("validation_eligible") is not True
            or not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in values)
            or not isinstance(dd, (int, float)) or isinstance(dd, bool) or not math.isfinite(dd)
            or not 0 <= dd <= 35):
        return None
    return tuple(values)


def next_candidate(candidates, trials):
    seen = {tuple(sorted(t["params"].items())) for t in trials}
    remaining = [p for p in candidates if tuple(sorted(p.items())) not in seen]
    if not remaining:
        return None
    eligible = [t for t in trials if t.get("status") == "COMPLETE"
                and t.get("validation_eligible") is True
                and validated_rank(t) is not None]
    if not eligible:
        return remaining[0]
    best = max(eligible, key=validated_rank)
    anchor = best["params"]
    # Independent-layer winners do not carry legacy shared parameter keys.
    anchor_iter = anchor.get("max_iter", anchor.get("direction_max_iter"))
    anchor_rate = anchor.get("learning_rate", anchor.get("direction_learning_rate"))
    return min(remaining, key=lambda p: (
        abs(p["max_iter"] - anchor_iter) / 100
        + abs(p["learning_rate"] - anchor_rate) / 0.05,
        p["max_iter"], p["learning_rate"]))


def next_layer_candidate(trials):
    """Propose independent layer parameters using validation-only diagnostics.

    Candidate exploration is deterministic; promotion remains controlled by the
    existing validation trading eligibility and score, not these diagnostics.
    """
    eligible = [t for t in trials if t.get("status") == "COMPLETE"
                and t.get("validation_eligible") is True
                and validated_rank(t) is not None]
    if not eligible:
        return None
    best = max(eligible, key=validated_rank)
    params = best["params"]
    def layer_value(layer, name):
        return params.get(layer + "_" + name, params.get(name))
    direction = best.get("diagnostics") or {}
    # Diagnostic availability gates exploration; performance still selects winners.
    brier = direction.get("direction_brier_score")
    upside = direction.get("upside_mae_percent")
    downside = direction.get("downside_mae_percent")
    if brier is None or upside is None or downside is None:
        return None
    # Error units differ; alternate the layer under exploration rather than
    # pretending Brier and percentage-point MAE are directly comparable.
    explored = sum(1 for t in trials
                   if "direction_max_iter" in t.get("params", {}))
    focus = "direction" if explored % 2 == 0 else "structure"
    tried = {tuple(sorted(t["params"].items())) for t in trials}
    for step_delta, rate_delta in ((20, 0), (-20, 0), (0, 0.01), (0, -0.01)):
        candidate = {
            "direction_max_iter": int(layer_value("direction", "max_iter")),
            "direction_learning_rate": float(layer_value("direction", "learning_rate")),
            "structure_max_iter": int(layer_value("structure", "max_iter")),
            "structure_learning_rate": float(layer_value("structure", "learning_rate")),
        }
        candidate[focus + "_max_iter"] = max(20, candidate[focus + "_max_iter"] + step_delta)
        candidate[focus + "_learning_rate"] = round(
            max(0.005, candidate[focus + "_learning_rate"] + rate_delta), 5)
        if tuple(sorted(candidate.items())) not in tried:
            return candidate
    return None
