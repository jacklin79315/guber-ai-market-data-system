from p3.experiment_scheduler import plan_next_experiment


def latest():
    return {"strategy": "INTRADAY", "run_key": "10:BTCUSDT:INTRADAY",
            "report": {
                "comparison_context": {"validation_window": [100, 200]},
                "experiment_history": {
                    "status": "NEW_VALIDATION_REQUIRED",
                    "next_experiment": {"max_iter": 80, "learning_rate": 0.05},
                },
            }}


def test_wait_for_unchanged_validation_window():
    result = plan_next_experiment([latest()], {"INTRADAY": [100, 200]})
    assert result["INTRADAY"]["status"] == "WAIT"
    assert result["INTRADAY"]["params"] is None


def test_ready_for_advanced_window_but_never_promote():
    result = plan_next_experiment([latest()], {"INTRADAY": [110, 210]})
    assert result["INTRADAY"]["status"] == "READY"
    assert result["INTRADAY"]["params"]["max_iter"] == 80
    assert not result["INTRADAY"]["auto_promote"]
    assert not result["INTRADAY"]["allow_holdout_selection"]


def test_no_audit_fails_closed():
    row = latest()
    row["report"].pop("experiment_history")
    assert plan_next_experiment([row], {"INTRADAY": [110, 210]})["INTRADAY"]["status"] == "WAIT"
