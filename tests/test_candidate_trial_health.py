from datetime import datetime, timezone, timedelta
from p3.candidate_trial_health import summarize_candidate_health, load_candidate_health


NOW = datetime(2026, 10, 15, tzinfo=timezone.utc)


def test_empty_history_is_healthy():
    result = summarize_candidate_health([], now=NOW)
    assert result["status"] == "HEALTHY"
    assert result["automatic_retry"] is False


def test_active_claim_is_running():
    result = summarize_candidate_health([{
        "trial_key": "a", "status": "CLAIMED",
        "claimed_at": (NOW - timedelta(minutes=10)).isoformat()}], now=NOW)
    assert result["status"] == "RUNNING"


def test_stale_claim_needs_attention():
    result = summarize_candidate_health([{
        "trial_key": "a", "status": "CLAIMED",
        "claimed_at": (NOW - timedelta(hours=4)).isoformat()}], now=NOW)
    assert result["status"] == "ATTENTION_REQUIRED"
    assert result["stale_claims"] == ["a"]


def test_failed_trial_exposes_reason():
    result = summarize_candidate_health([{
        "trial_key": "a", "status": "FAILED",
        "error_reason": "claim_timeout_manual_review_required"}], now=NOW)
    assert result["status"] == "ATTENTION_REQUIRED"
    assert result["failed_trials"][0]["reason"] == "claim_timeout_manual_review_required"


def test_load_queries_only_status_fields():
    def db(method, table, params):
        assert method == "GET"
        assert table == "ai_candidate_trials"
        assert "params" not in params["select"]
        return []
    assert load_candidate_health(db, "BTCUSDT")["inspected_rows"] == 0
