"""Read-only Champion/Challenger review. Never promote from holdout metrics."""
from .model_version_comparison import compare_versions

def review_challenger(champion, challenger):
    qualification = challenger.get("qualification") or {}
    if not qualification.get("holdout_accepted", False):
        return {"decision": "REJECT", "reason": "independent_acceptance_not_met",
                "promotion_authorized": False}
    if qualification.get("paper_eligible", False):
        return {"decision": "REVIEW", "reason": "paper_activation_requires_separate_authorization",
                "promotion_authorized": False}
    comparison = compare_versions(champion, challenger)
    return {**comparison, "promotion_authorized": False}
