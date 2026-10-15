"""Read-only operational health for candidate experiment claims."""
from datetime import datetime, timezone


def summarize_candidate_health(rows, *, now=None, stale_minutes=180):
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must be timezone aware")
    counts = {s: 0 for s in ("CLAIMED", "VALIDATION_EVALUATED",
                             "VALIDATION_REJECTED", "FAILED")}
    stale = []
    failures = []
    for row in rows:
        status = row.get("status")
        if status not in counts:
            raise ValueError("unknown candidate trial status")
        counts[status] += 1
        if status == "FAILED":
            failures.append({"trial_key": row.get("trial_key"),
                             "reason": row.get("error_reason")})
        if status == "CLAIMED":
            claimed = row.get("claimed_at")
            if not isinstance(claimed, str):
                stale.append(row.get("trial_key"))
                continue
            try:
                stamp = datetime.fromisoformat(claimed.replace("Z", "+00:00"))
                if stamp.tzinfo is None or (now - stamp).total_seconds() > stale_minutes * 60:
                    stale.append(row.get("trial_key"))
            except ValueError:
                stale.append(row.get("trial_key"))
    return {
        "status": "ATTENTION_REQUIRED" if stale or failures else
                  ("RUNNING" if counts["CLAIMED"] else "HEALTHY"),
        "counts": counts, "stale_claims": stale, "failed_trials": failures,
        "automatic_retry": False, "paper_trading_enabled": False,
    }


def load_candidate_health(db, symbol, *, limit=500):
    if not isinstance(limit, int) or not 1 <= limit <= 1000:
        raise ValueError("invalid health query limit")
    rows = db("GET", "ai_candidate_trials", {
        "select": "trial_key,status,claimed_at,error_reason",
        "symbol": "eq." + symbol, "order": "created_at.desc",
        "limit": str(limit),
    })
    return {"symbol": symbol, **summarize_candidate_health(rows),
            "inspected_rows": len(rows), "partial_history": len(rows) == limit}
