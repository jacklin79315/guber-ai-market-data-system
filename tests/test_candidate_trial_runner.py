import pytest
from p3.candidate_trial_runner import evaluate_candidate_trials


def schedule():
    return {"decisions": {"INTRADAY": {
        "status": "READY", "params": {"max_iter": 80, "learning_rate": 0.05},
        "current_validation_window": [100, 200]}}}


def test_candidate_trial_validation_only():
    calls = []
    def trainer(features, candles, strategy, *, years, model_params):
        calls.append(("train", strategy, model_params))
        return {"windows": {"validation": (100, 200)}, "model": object()}
    def selector(candles, features, model, symbol, window, fee_rate):
        calls.append(("validation", window))
        return {"selected_threshold": 0.6,
                "candidates": [{"threshold": 0.6, "return_percent": 5.0,
                                "drawdown_percent": 2.0}]}
    rows = evaluate_candidate_trials(
        schedule(), symbol="BTCUSDT", years=2,
        candles_by_timeframe={"15m": []}, features_by_timeframe={"15m": []},
        fee_rate=0.001, trainer=trainer, selector=selector)
    assert len(rows) == 1
    assert rows[0]["validation_score"] == 3.0
    assert rows[0]["holdout_evaluated"] is False
    assert rows[0]["paper_eligible"] is False
    assert rows[0]["auto_promote"] is False
    assert [x[0] for x in calls] == ["train", "validation"]


def test_candidate_trial_rejects_window_drift():
    def trainer(*args, **kwargs):
        return {"windows": {"validation": (110, 210)}, "model": object()}
    with pytest.raises(ValueError, match="validation window changed"):
        evaluate_candidate_trials(
            schedule(), symbol="BTCUSDT", years=2,
            candles_by_timeframe={"15m": []}, features_by_timeframe={"15m": []},
            fee_rate=0.001, trainer=trainer)


def test_wait_never_trains():
    assert evaluate_candidate_trials(
        {"decisions": {"INTRADAY": {"status": "WAIT"}}},
        symbol="BTCUSDT", years=2, candles_by_timeframe={},
        features_by_timeframe={}, fee_rate=0.001) == []
