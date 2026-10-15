"""Select a historical OOS evaluation window without lookahead."""
def historical_evaluation_window(snapshots, *, evaluation_bars, holding_bars,
                                 offset_bars=0, minimum_history=100):
    if any(not isinstance(v, int) or isinstance(v, bool) for v in
           (evaluation_bars, holding_bars, offset_bars, minimum_history)):
        raise ValueError("window arguments must be integers")
    if evaluation_bars < 1 or holding_bars < 1 or offset_bars < 0 or minimum_history < 0:
        raise ValueError("invalid evaluation window")
    if len(snapshots) < evaluation_bars + holding_bars + offset_bars + minimum_history:
        raise ValueError("insufficient historical research snapshots")
    start = snapshots[-(evaluation_bars + holding_bars + offset_bars)]["timestamp_ms"]
    end = snapshots[-(holding_bars + offset_bars + 1)]["timestamp_ms"]
    if end < start:
        raise ValueError("invalid historical window ordering")
    return start, end
