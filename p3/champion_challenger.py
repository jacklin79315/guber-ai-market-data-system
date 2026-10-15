"""Read-only Champion/Challenger review. Never promote from holdout metrics."""
from .model_version_comparison import compare_versions

def review_challenger(champion, challenger):
    if not challenger.get("qualification", {}).get("holdout_accepted", False):
        return {"decision": "REJECT", "reason": "independent_acceptance_not_met"}
    if challenger.get("qualification", {}).get("paper_eligible", False):
        return {"decision": "REVIEW", "reason": "paper_activation_requires_separate_authorization"}
    comparison = compare_versions(champion, challenger)
    if comparison["decision"] == "REVIEW":
        return {**comparison, "promotion_authorized": False}
    return {**comparison, "promotion_authorized": False}
