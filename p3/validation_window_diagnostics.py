"""Read-only audit of intended validation windows versus actual replay candles."""
EMBARGO_MS = 30 * 86400000  # Mirrors the existing 30-day validation embargo.


def audit_validation_window(candles, features, validation_window):
    begin, end = validation_window
    earliest = begin + EMBARGO_MS
    selected = [c for c in candles if earliest <= int(c["open_time"])
                and int(c["close_time"]) < end]
    feature_times = {int(row["close_time"]) for row in features}
    matched = [c for c in selected if int(c["close_time"]) in feature_times]
    return {
        "validation_start_ms": begin,
        "validation_end_ms": end,
        "replay_eligible_start_ms": earliest,
        "planned_window_days": (end - begin) / 86400000,
        "after_embargo_days": max(0, (end - earliest) / 86400000),
        "loaded_candles": len(candles),
        "loaded_first_open_ms": int(candles[0]["open_time"]) if candles else None,
        "loaded_last_close_ms": int(candles[-1]["close_time"]) if candles else None,
        "selected_candles": len(selected),
        "selected_first_open_ms": int(selected[0]["open_time"]) if selected else None,
        "selected_last_close_ms": int(selected[-1]["close_time"]) if selected else None,
        "feature_matched": len(matched),
        "feature_missing": len(selected) - len(matched),
        "selected_span_days": (
            (int(selected[-1]["close_time"]) - int(selected[0]["open_time"]) + 1) / 86400000
            if selected else 0
        ),
    }
