"""Optional multi-lot validation adapter; existing model selection stays unchanged."""
from .multi_position_replay import replay_multi_positions
from .validation_window_diagnostics import audit_validation_window, EMBARGO_MS


def evaluate_multi_lot_window(candles, features, model, symbol, window, threshold, fee_rate, *, settle_at_end=True):
    begin, end = window
    selected = [c for c in candles if begin + EMBARGO_MS <= int(c["open_time"])
                and int(c["close_time"]) < end]
    if len(selected) < 2:
        raise ValueError("insufficient validation candles")
    rows = {int(row["close_time"]): row for row in features}
    decisions = {int(c["close_time"]): model.decide(
        symbol, rows[int(c["close_time"])], confidence_threshold=threshold)
        for c in selected if int(c["close_time"]) in rows}
    result = replay_multi_positions({symbol: selected}, {symbol: decisions}, fee_rate=fee_rate, settle_at_end=settle_at_end)
    result["coverage"] = audit_validation_window(candles, features, window)
    return result
