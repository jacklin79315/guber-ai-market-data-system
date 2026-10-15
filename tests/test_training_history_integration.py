from p3.training_registry import record_training_reports


def test_registry_reads_supabase_history_and_blocks_duplicate():
    calls = []
    report = {
        "timeframe": "1h", "validation_selection": {
            "selected_threshold": None, "candidates": []},
        "qualification": {"validation_eligible": False, "paper_eligible": False},
        "final_equity": 10000, "max_close_to_close_drawdown_percent": 0,
        "closed_trades": 0, "execution_path_uncertain": False,
        "validation_window": [100, 200],
        "optimization": {
            "experiments": [{"params": {"max_iter": 120}}],
            "next_experiment": {"params": {"max_iter": 180},
                                "reason": "validation_no_closed_trades"},
        },
        "provenance": {"dataset_version": "d", "feature_version": "f",
                       "fee_version": "fee", "code_version": "code"},
    }

    def db(method, table, params=None, payload=None, extra=None):
        calls.append((method, table))
        if method == "POST":
            return []
        if method == "GET":
            assert params["symbol"] == "eq.BTCUSDT"
            assert params["limit"] == "500"
            assert params["offset"] == "0"
            old = {
                "run_key": "older:BTCUSDT:ONE_TO_THREE_DAYS",
                "symbol": "BTCUSDT", "strategy": "ONE_TO_THREE_DAYS",
                "timeframe": "1h", "lookback_years": 2,
                "report": {
                    "comparison_context": {
                        "validation_window": [100, 200],
                        "evaluation_version": "p3-validation-v1",
                        "dataset_version": "d", "feature_version": "f",
                        "fee_version": "fee", "code_version": "old"},
                    "optimization": {"experiments": [
                        {"params": {"max_iter": 180}}]},
                },
            }
            return [old]
        raise AssertionError(method)

    import os
    original = os.environ.get("GITHUB_RUN_ID")
    os.environ["GITHUB_RUN_ID"] = "new"
    try:
        result = record_training_reports(db, "BTCUSDT", 2,
                                         {"ONE_TO_THREE_DAYS": report})
    finally:
        if original is None:
            os.environ.pop("GITHUB_RUN_ID", None)
        else:
            os.environ["GITHUB_RUN_ID"] = original
    assert result["recorded"]
    assert result["history_rows"] == 1
    assert result["experiment_history"]["ONE_TO_THREE_DAYS"]["status"] == "DUPLICATE_PROPOSAL"
    assert calls == [("GET", "ai_training_runs"), ("POST", "ai_training_runs")]
