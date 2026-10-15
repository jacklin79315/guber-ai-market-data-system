from p3.experiment_history import compare_experiment_history, authorize_next_validation


def row(run_key, params, *, window=None, proposed=None):
    return {
        "run_key": run_key, "symbol": "BTCUSDT", "strategy": "INTRADAY",
        "timeframe": "15m", "lookback_years": 2,
        "report": {
            "comparison_context": {
                "validation_window": window or [100, 200],
                "evaluation_version": "v1", "dataset_version": "data1",
                "feature_version": "features1", "fee_version": "fees1",
                "code_version": run_key,
            },
            "optimization": {
                "experiments": [{"params": params}],
                "next_experiment": {"params": proposed, "reason": "validation_no_closed_trades"},
            },
        },
    }


def test_repeated_parameters_blocked_even_across_code_commits():
    current = row("new", {"max_iter": 120}, proposed={"max_iter": 180})
    previous = row("old", {"max_iter": 180})
    result = compare_experiment_history(current, [previous])
    assert result["status"] == "DUPLICATE_PROPOSAL"
    assert result["next_experiment"] is None
    assert result["comparable_runs"] == 1
    assert not result["auto_execute"]


def test_changed_validation_window_is_not_comparable():
    current = row("new", {"max_iter": 120}, proposed={"max_iter": 180})
    previous = row("old", {"max_iter": 180}, window=[200, 300])
    result = compare_experiment_history(current, [previous])
    assert result["status"] == "NEW_VALIDATION_REQUIRED"
    assert result["comparable_runs"] == 0
    assert not result["auto_promote"]


def test_missing_context_fails_closed():
    current = row("new", {"max_iter": 120}, proposed={"max_iter": 180})
    del current["report"]["comparison_context"]["feature_version"]
    result = compare_experiment_history(current, [])
    assert result["status"] == "NO_COMPARABLE_CONTEXT"
    assert result["next_experiment"] is None


def test_next_validation_gate_rejects_same_or_backward_window():
    audit = {"status": "NEW_VALIDATION_REQUIRED",
             "next_experiment": {"max_iter": 240}}
    assert not authorize_next_validation(audit, [100, 200], [100, 200])["authorized"]
    assert not authorize_next_validation(audit, [100, 200], [90, 220])["authorized"]
    assert not authorize_next_validation(audit, [100, 200], [120, 190])["authorized"]
    assert not authorize_next_validation(audit, [100, 200], None)["authorized"]


def test_next_validation_gate_only_allows_forward_window_without_promotion():
    audit = {"status": "NEW_VALIDATION_REQUIRED",
             "next_experiment": {"max_iter": 240}}
    from p3.ai_training_pipeline import EMBARGO_MS
    result = authorize_next_validation(audit, [100, 200], [200 + EMBARGO_MS, 300 + EMBARGO_MS])
    assert result["authorized"]
    assert result["params"] == {"max_iter": 240}
    assert not result["auto_promote"]
    assert not result["allow_holdout_selection"]


def test_shifted_validation_window_is_not_fresh():
    audit = {"status": "NEW_VALIDATION_REQUIRED",
             "next_experiment": {"max_iter": 240}}
    assert authorize_next_validation(audit, [100, 200], [110, 210])["reason"] == "validation_overlap_or_embargo"
