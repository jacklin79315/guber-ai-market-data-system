"""Reproducible provenance identifiers; fail closed if source metadata is absent."""
import hashlib
import json
import os


def fingerprint_rows(rows, fields):
    """Stable SHA256 of ordered source values, independent of dict key ordering."""
    if not rows:
        raise ValueError("cannot fingerprint empty source")
    digest = hashlib.sha256()
    previous = None
    for row in rows:
        key = int(row["open_time"])
        if previous is not None and key <= previous:
            raise ValueError("source timestamps not strictly increasing")
        previous = key
        values = [row.get(field) for field in fields]
        if any(value is None for value in values):
            raise ValueError("source fingerprint field missing")
        digest.update(json.dumps(values, separators=(",", ":"), ensure_ascii=True, default=str).encode())
        digest.update(bytes([10]))
    return "sha256:" + digest.hexdigest()


def pinned_code_version():
    sha = os.getenv("GITHUB_SHA", "").strip()
    if len(sha) != 40 or any(c not in "0123456789abcdefABCDEF" for c in sha):
        return None
    return "git:" + sha.lower()


def fee_fingerprint(fee_rate):
    return "sha256:" + hashlib.sha256(
        json.dumps({"fee_rate_per_side": str(fee_rate), "fee_assumption": "symmetric_spot"},
                   sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
