"""Point-in-time supervised training pipeline for four independent horizons.

Strict chronological 24/6/6-month partitions for three-year histories, with
30-day embargo before validation and holdout. Labels must end inside their
own partition. The final holdout is never used to fit models.
"""
from datetime import datetime, timezone
from calendar import monthrange
from .ai_decision_model import HorizonModel, HORIZON_BARS, build_supervised_examples
from .multi_model_replay import STRATEGY_TIMEFRAMES

DAY_MS = 86400000
EMBARGO_MS = 30 * DAY_MS

def _add_months(timestamp_ms, months):
    d = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
    m = d.year * 12 + d.month - 1 + months
    year, month = divmod(m, 12)
    month += 1
    day = min(d.day, monthrange(year, month)[1])
    return int(d.replace(year=year, month=month, day=day).timestamp() * 1000)

def chronological_windows(start_ms, *, years=2):
    if years == 2:
        months = (16, 4, 4)
    elif years == 3:
        months = (24, 6, 6)
    elif years == 1:
        months = (8, 2, 2)
    else:
        raise ValueError("supported windows: 1, 2 or 3 years")
    train_end = _add_months(start_ms, months[0])
    val_end = _add_months(train_end, months[1])
    test_end = _add_months(val_end, months[2])
    return {
        "train": (start_ms, train_end),
        "validation": (train_end, val_end),
        "holdout": (val_end, test_end),
    }

def train_horizon(features, candles, strategy, *, years=2):
    """Fit on training only; return model and partitioned evaluation samples.

    Each label consumes up to horizon_bars * timeframe milliseconds AFTER
    the decision candle. A sample is accepted only if the entire label
    window ends before the partition boundary. No random split.
    """
    if strategy not in STRATEGY_TIMEFRAMES:
        raise ValueError("unknown strategy")
    if not candles:
        raise ValueError("empty candle history")
    timeframe = STRATEGY_TIMEFRAMES[strategy]
    interval = {"15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000}[timeframe]
    horizon = HORIZON_BARS[strategy]
    end = int(candles[-1]["close_time"]) + 1
    start = _add_months(end, -12 * years)
    windows = chronological_windows(start, years=years)
    if int(candles[-1]["close_time"]) + 1 < windows["holdout"][1]:
        raise ValueError("insufficient full historical coverage")
    # Feature warm-up gaps are allowed only before the first usable sample.
    # Report effective coverage rather than claiming the raw-candle span is fully trained.
    X, y, up, down, times = build_supervised_examples(features, candles, horizon)
    if not times:
        raise ValueError("no aligned feature/candle training examples")
    partitions = {}
    for name, (begin, end) in windows.items():
        earliest = begin if name == "train" else begin + EMBARGO_MS
        indices = [i for i, t in enumerate(times)
                   if earliest <= t and t + horizon * interval < end]
        partitions[name] = {
            "X": X[indices], "y_direction": y[indices],
            "y_up": up[indices], "y_down": down[indices],
            "decision_times": [times[i] for i in indices],
        }
    training = partitions["train"]
    coverage = {name: {"samples": len(part["decision_times"]),
                       "first_decision_ms": part["decision_times"][0] if part["decision_times"] else None,
                       "last_decision_ms": part["decision_times"][-1] if part["decision_times"] else None}
                for name, part in partitions.items()}
    model = HorizonModel().fit(training["X"], training["y_direction"],
                               training["y_up"], training["y_down"])
    return {"model": model, "partitions": partitions, "windows": windows,
            "strategy": strategy, "timeframe": timeframe, "coverage": coverage}
