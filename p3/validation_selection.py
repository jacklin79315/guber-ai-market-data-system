"""Validation-only candidate ranking, with an untouched final holdout."""
from .validation_window_diagnostics import EMBARGO_MS
from .multi_position_replay import replay_multi_positions

THRESHOLDS = (0.55, 0.60, 0.65, 0.70)
MIN_TRADES = 5
MAX_VALIDATION_DRAWDOWN_PERCENT = 8.0


def evaluate_window(candles, features, model, symbol, window, threshold, fee_rate):
    begin, end = window
    earliest = begin + EMBARGO_MS
    selected = [c for c in candles if earliest <= int(c["open_time"]) and int(c["close_time"]) < end]
    if len(selected) < 2:
        raise ValueError("insufficient validation candles")
    rows = {int(row["close_time"]): row for row in features}
    decisions = {int(c["close_time"]): model.decide(symbol, rows[int(c["close_time"])], confidence_threshold=threshold)
                 for c in selected if int(c["close_time"]) in rows}
    return replay_multi_positions({symbol: selected}, {symbol: decisions}, fee_rate=fee_rate)


def diagnose_decision_flow(candles, features, model, symbol, window, threshold):
    """Read-only decision funnel; does not alter selection or replay."""
    begin, end = window
    earliest = begin + EMBARGO_MS
    selected = [c for c in candles if earliest <= int(c["open_time"])
                and int(c["close_time"]) < end]
    rows = {int(row["close_time"]): row for row in features}
    counts = {"validation_bars": len(selected), "feature_matched": 0,
              "feature_missing": 0, "LONG": 0, "SHORT": 0, "WAIT": 0,
              "direction_confidence_filtered": 0, "price_range_filtered": 0}
    for candle in selected:
        row = rows.get(int(candle["close_time"]))
        if row is None:
            counts["feature_missing"] += 1
            continue
        counts["feature_matched"] += 1
        decision = model.decide(symbol, row, confidence_threshold=threshold)
        counts[decision.action] += 1
        if decision.action == "WAIT":
            probability = model.analyze_direction(row)
            if 1 - threshold < probability < threshold:
                counts["direction_confidence_filtered"] += 1
            else:
                counts["price_range_filtered"] += 1
    return counts


def select_threshold(candles, features, model, symbol, validation_window, fee_rate):
    candidates = []
    for threshold in THRESHOLDS:
        replay_result = evaluate_window(candles, features, model, symbol, validation_window,
                                        threshold, fee_rate)
        metrics = replay_result["metrics"]
        flow = diagnose_decision_flow(candles, features, model, symbol,
                                      validation_window, threshold)
        events = replay_result["events"]
        flow["entries_filled"] = sum(e["type"] == "ENTRY" for e in events)
        flow["exits_recorded"] = sum(e["type"] == "EXIT" for e in events)
        flow["unfilled_or_position_blocked"] = (
            flow["LONG"] + flow["SHORT"] - flow["entries_filled"])
        flow["open_position_at_end"] = bool(replay_result["account"].positions)
        metrics["execution_path_uncertain"] = bool(
            metrics["entry_bars_with_unresolved_exit"] or metrics["ambiguous_exit_count"])
        trades = metrics["closed_trades"]
        candidates.append({
            "threshold": threshold,
            "decision_flow": flow,
            "closed_trades": trades,
            "eligible": trades >= MIN_TRADES and not metrics["execution_path_uncertain"] and metrics["max_close_to_close_drawdown_percent"] <= MAX_VALIDATION_DRAWDOWN_PERCENT,
            "return_percent": 100 * (metrics["final_mark_to_market_equity"] / 10000 - 1),
            "drawdown_percent": metrics["max_close_to_close_drawdown_percent"],
            "execution_path_uncertain": metrics["execution_path_uncertain"],
            "win_rate_percent": metrics.get("win_rate_percent"),
            "mean_score_q": metrics.get("mean_score_q"),
            "annualized_return_percent": metrics.get("annualized_return_percent"),
            "annualized_mark_to_market_return_percent": metrics.get("annualized_mark_to_market_return_percent"),
        })
    eligible = [c for c in candidates if c["eligible"]]
    winner = max(eligible, key=lambda c: (c["return_percent"] - c["drawdown_percent"],
                                         c["return_percent"], c["threshold"])) if eligible else None
    return {"selected_threshold": winner["threshold"] if winner else None,
            "candidates": candidates, "selection_source": "validation_only"}
