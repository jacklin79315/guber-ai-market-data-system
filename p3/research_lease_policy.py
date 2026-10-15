"""Pure lease-state policy for autonomous research orchestration.

Persistence must use an atomic database claim; this module alone is not a lock.
All timestamps are timezone-aware UTC datetimes.
"""
from datetime import datetime, timedelta, timezone

TERMINAL = frozenset({"SUCCEEDED", "FAILED", "CANCELLED"})
ACTIVE = frozenset({"CLAIMED", "RUNNING"})


def utc(value):
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ValueError("timezone-aware datetime required")
    return value.astimezone(timezone.utc)


def lease_decision(job, *, now, lease_seconds=900):
    """Decide whether a database transaction may claim/reclaim a research job."""
    now = utc(now)
    if not isinstance(lease_seconds, int) or lease_seconds <= 0:
        raise ValueError("lease_seconds must be positive")
    if job is None:
        return {"status": "CLAIMABLE", "reason": "new_job"}
    status = job.get("status")
    if status in TERMINAL:
        return {"status": "WAIT", "reason": "terminal_job"}
    if status not in ACTIVE:
        return {"status": "WAIT", "reason": "unknown_job_state"}
    expires_at = job.get("lease_expires_at")
    if expires_at is None:
        return {"status": "WAIT", "reason": "missing_lease_expiry"}
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    expires_at = utc(expires_at)
    if expires_at > now:
        return {"status": "WAIT", "reason": "active_lease"}
    return {"status": "CLAIMABLE", "reason": "expired_lease"}


def next_expiry(*, now, lease_seconds=900):
    if not isinstance(lease_seconds, int) or lease_seconds <= 0:
        raise ValueError("lease_seconds must be positive")
    return (utc(now) + timedelta(seconds=lease_seconds)).isoformat()
