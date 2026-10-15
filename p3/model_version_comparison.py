"""Pure, fail-closed model version comparison. Never optimize using holdout."""
import math

def _score(row):
    value = row.get("validation_score")
    if value is None:
        return None
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    return score if math.isfinite(score) else None

def comparable(a, b):
    """Require identical evaluation context before ranking."""
    keys = ("symbol", "strategy", "timeframe", "lookback_years",
            "validation_window", "evaluation_version", "dataset_version",
            "feature_version", "fee_version")
    return all(a.get(k) == b.get(k) for k in keys) and all(
        a.get(k) is not None for k in keys
    )

def compare_versions(champion, challenger):
    """Returns a recommendation only; never mutates active model state."""
    if not challenger.get("validation_eligible"):
        return {"decision": "REJECT", "reason": "validation_ineligible"}
    if _score(challenger) is None:
        return {"decision": "REJECT", "reason": "missing_validation_score"}
    if champion is None:
        return {"decision": "REVIEW", "reason": "no_champion_manual_acceptance_required"}
    if not comparable(champion, challenger):
        return {"decision": "INCOMPARABLE", "reason": "evaluation_context_mismatch"}
    if not champion.get("validation_eligible") or _score(champion) is None:
        return {"decision": "REVIEW", "reason": "champion_metadata_incomplete"}
    if _score(challenger) <= _score(champion):
        return {"decision": "KEEP_CHAMPION", "reason": "no_validation_improvement"}
    return {"decision": "REVIEW", "reason": "validation_improved_requires_independent_acceptance"}
