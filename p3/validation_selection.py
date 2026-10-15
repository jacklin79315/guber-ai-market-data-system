"""Validation-only candidate ranking, with an untouched final holdout."""
from .ai_training_pipeline import EMBARGO_MS
from .replay_runner import replay_with_metrics

THRESHOLDS = (0.55, 0.60, 0.65, 0.70)
MIN_TRADES = 5


def evaluate_window(candles, features, model, symbol, window, threshold, fee_rate):
    begin, end = window
    earliest = begin + EMBARGO_MS
    selected = [c for c in candles if earliest <= int(c["open_time"]) and int(c["close_time"]) < end]
    if len(selected) < 2:
        raise ValueError("insufficient validation candles")
    rows = {int(row["close_time"]): row for row in features}
    decisions = {int(c["close_time"]): model.decide(symbol, rows[int(c["close_time"])], confidence_threshold=threshold)
                 for c in selected if int(c["close_time"]) in rows}
    return replay_with_metrics(selected, decisions, fee_rate=fee_rate)


def select_threshold(candles, features, model, symbol, validation_window, fee_rate):
    candidates = []
    for threshold in THRESHOLDS:
        metrics = evaluate_window(candles, features, model, symbol, validation_window,
                                  threshold, fee_rate)["metrics"]
        trades = metrics["closed_trades"]
        candidates.append({
            "threshold": threshold,
            "closed_trades": trades,
            "eligible": trades >= MIN_TRADES,
            "return_percent": 100 * (metrics["final_mark_to_market_equity"] / 10000 - 1),
            "drawdown_percent": metrics["max_close_to_close_drawdown_percent"],
            "execution_path_uncertain": metrics["execution_path_uncertain"],
        })
    eligible = [c for c in candidates if c["eligible"]]
    winner = max(eligible, key=lambda c: (c["return_percent"] - c["drawdown_percent"],
                                         c["return_percent"], c["threshold"])) if eligible else None
    return {"selected_threshold": winner["threshold"] if winner else None,
            "candidates": candidates, "selection_source": "validation_only"}
