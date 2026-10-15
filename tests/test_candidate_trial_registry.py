import os
from unittest.mock import patch
from p3.candidate_trial_registry import record_candidate_trials


def sample():
    return {"strategy": "INTRADAY", "validation_window": [100, 200],
            "params": {"max_iter": 80, "learning_rate": 0.05},
            "validation_score": 3.0, "selected_threshold": 0.6,
            "validation_eligible": True, "validation_candidates": []}


def test_separate_registry_never_persists_holdout_metrics():
    saved = []
    def db(method, table, params, payload, headers):
        assert method == "POST"
        assert table == "ai_candidate_trials"
        saved.extend(payload)
    with patch.dict(os.environ, {"GITHUB_RUN_ID": "999"}):
        result = record_candidate_trials(db, "BTCUSDT", 2, [sample()])
    assert result["count"] == 1
    assert saved[0]["trial_key"] == "999:BTCUSDT:INTRADAY:candidate"
    assert saved[0]["report"]["holdout_evaluated"] is False
    assert saved[0]["report"]["auto_promote"] is False
    assert "holdout_return_percent" not in saved[0]


def test_no_run_id_fails_closed():
    with patch.dict(os.environ, {"GITHUB_RUN_ID": ""}):
        assert not record_candidate_trials(
            lambda *args: (_ for _ in ()).throw(AssertionError("db called")),
            "BTCUSDT", 2, [sample()])["recorded"]


def test_atomic_claim_only_accepts_true():
    from p3.candidate_trial_registry import claim_candidate_trials
    def db(method, table, params=None, payload=None):
        assert table == "rpc/claim_ai_candidate_trial"
        return False
    with patch.dict(os.environ, {"GITHUB_RUN_ID": "123"}):
        assert claim_candidate_trials(db, "BTCUSDT", 2, [{
            "strategy": "INTRADAY", "validation_window": [100, 200],
            "params": {"max_iter": 80, "learning_rate": 0.05}}]) == []


def test_expiry_rejects_unexpected_result_and_invalid_threshold():
    import pytest
    from p3.candidate_trial_registry import expire_stale_claims
    with pytest.raises(ValueError):
        expire_stale_claims(lambda *a, **k: 0, older_than_minutes=5)
    with pytest.raises(RuntimeError):
        expire_stale_claims(lambda *a, **k: True)
    assert expire_stale_claims(lambda *a, **k: 2) == 2
