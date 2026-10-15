"""Append-only, fail-closed model review persistence. Never changes active models."""
from .champion_challenger import review_challenger

REVIEW_FIELDS = "run_key,symbol,strategy,timeframe,lookback_years,validation_score,validation_eligible,report"


def _record_to_candidate(row):
    context = (row.get("report") or {}).get("comparison_context") or {}
    return {**row, **context, "qualification": (row.get("report") or {}).get("qualification") or {}}


def record_model_review(db, challenger_run_key, champion_run_key=None):
    """Persist an audit decision; no automatic champion discovery or promotion."""
    if not challenger_run_key or (champion_run_key is not None and champion_run_key == challenger_run_key):
        raise ValueError("distinct challenger and champion run keys required")
    challenger_rows = db("GET", "ai_training_runs",
                         {"select": REVIEW_FIELDS, "run_key": "eq." + challenger_run_key, "limit": "2"})
    if len(challenger_rows) != 1:
        raise ValueError("challenger run not uniquely found")
    champion = None
    if champion_run_key is not None:
        champion_rows = db("GET", "ai_training_runs",
                           {"select": REVIEW_FIELDS, "run_key": "eq." + champion_run_key, "limit": "2"})
        if len(champion_rows) != 1:
            raise ValueError("champion run not uniquely found")
        champion = _record_to_candidate(champion_rows[0])
    challenger = _record_to_candidate(challenger_rows[0])
    outcome = review_challenger(champion, challenger)
    context = {k: challenger.get(k) for k in
               ("validation_window", "evaluation_version", "dataset_version",
                "feature_version", "fee_version")}
    payload = {
        "challenger_run_key": challenger_run_key,
        "champion_run_key": champion_run_key,
        "decision": outcome["decision"],
        "reason": outcome["reason"],
        "promotion_authorized": False,
        "comparison_context": context,
    }
    # Check existing audit first; database unique indexes also reject concurrent duplicates.
    filters = {"select": "id,decision,reason", "challenger_run_key": "eq." + challenger_run_key,
               "champion_run_key": ("eq." + champion_run_key) if champion_run_key else "is.null"}
    existing = db("GET", "ai_model_reviews", filters)
    if existing:
        return {**payload, "decision": existing[0]["decision"],
                "reason": existing[0]["reason"], "already_recorded": True}
    db("POST", "ai_model_reviews", None, [payload], {"Prefer": "return=minimal"})
    return payload
