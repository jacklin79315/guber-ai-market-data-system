from p3.experiment_scheduler import plan_next_experiment, load_schedule_from_supabase


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
    from p3.ai_training_pipeline import EMBARGO_MS
    result = plan_next_experiment([latest()], {"INTRADAY": [200 + EMBARGO_MS, 300 + EMBARGO_MS]})
    assert result["INTRADAY"]["status"] == "READY"
    assert result["INTRADAY"]["params"]["max_iter"] == 80
    assert not result["INTRADAY"]["auto_promote"]
    assert not result["INTRADAY"]["allow_holdout_selection"]


def test_no_audit_fails_closed():
    row = latest()
    row["report"].pop("experiment_history")
    assert plan_next_experiment([row], {"INTRADAY": [110, 210]})["INTRADAY"]["status"] == "WAIT"


def test_supabase_preflight_uses_latest_native_candle():
    from p3.ai_training_pipeline import _add_months, DAY_MS
    from p3.multi_model_replay import STRATEGY_TIMEFRAMES
    from datetime import datetime, timezone
    end = int(datetime(2026, 10, 15, tzinfo=timezone.utc).timestamp() * 1000)
    calls = []
    def db(method, table, params):
        calls.append((table, params))
        if table == "ai_training_runs":
            return []
        if table == "raw_candles":
            return [{"close_time": end - 1}]
        raise AssertionError(table)
    result = load_schedule_from_supabase(db, "BTCUSDT", years=2)
    assert result["history_rows"] == 0
    assert calls[0][1]["order"] == "trained_at.desc,id.desc"
    assert len([x for x in calls if x[0] == "raw_candles"]) == len(STRATEGY_TIMEFRAMES)
    start = _add_months(end, -24)
    assert result["validation_windows"]["INTRADAY"][0] == _add_months(start, 16)
    assert result["decisions"] == {}


def test_preflight_without_candles_fails_closed():
    def db(method, table, params):
        return []
    result = load_schedule_from_supabase(db, "BTCUSDT", years=2)
    assert all(value is None for value in result["validation_windows"].values())


def test_shifted_validation_remains_wait():
    result = plan_next_experiment([latest()], {"INTRADAY": [110, 210]})
    assert result["INTRADAY"]["status"] == "WAIT"
    assert result["INTRADAY"]["reason"] == "validation_overlap_or_embargo"
