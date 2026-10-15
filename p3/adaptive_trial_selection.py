"""Sequential trial selection using prior completed outcomes, not a static trial order.

Only validation-eligible completed trials guide the next candidate. When there
is no usable feedback, explore the remaining grid deterministically.
"""
def next_candidate(candidates, trials):
    seen = {tuple(sorted(t["params"].items())) for t in trials}
    remaining = [p for p in candidates if tuple(sorted(p.items())) not in seen]
    if not remaining:
        return None
    eligible = [t for t in trials if t.get("status") == "COMPLETE"
                and t.get("validation_eligible") is True
                and t.get("validation_score") is not None]
    if not eligible:
        return remaining[0]
    best = max(eligible, key=lambda t: float(t["validation_score"]))
    anchor = best["params"]
    return min(remaining, key=lambda p: (
        abs(p["max_iter"] - anchor["max_iter"]) / 100
        + abs(p["learning_rate"] - anchor["learning_rate"]) / 0.05,
        p["max_iter"], p["learning_rate"]))


def next_layer_candidate(trials):
    """Propose independent layer parameters using validation-only diagnostics.

    Candidate exploration is deterministic; promotion remains controlled by the
    existing validation trading eligibility and score, not these diagnostics.
    """
    eligible = [t for t in trials if t.get("status") == "COMPLETE"
                and t.get("validation_eligible") is True
                and t.get("validation_score") is not None]
    if not eligible:
        return None
    best = max(eligible, key=lambda t: float(t["validation_score"]))
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
