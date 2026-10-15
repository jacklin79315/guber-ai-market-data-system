"""Persist settled paper research observations, never live orders."""
from math import isfinite

PLAN_VERSION = "fixed_sl2_tp3_fee10bp_slip10bp_v1"
DATA_VERSION = "binance_spot_native_market_features_v1"


def save_settled_outcomes(db, *, symbol, strategy, timeframe, records, asof_ms):
    rows = []
    seen = set()
    for item in records:
        t, end = item["signal_time_ms"], item["label_end_ms"]
        key = (t, item["direction"])
        if key in seen:
            raise ValueError("duplicate paper outcome in batch")
        seen.add(key)
        if not (0 < t < end <= asof_ms):
            raise ValueError("paper outcome is not settled as of run time")
        value = float(item["net_r"])
        if not isfinite(value):
            raise ValueError("nonfinite paper outcome")
        rows.append({
            "symbol": symbol, "strategy": strategy, "timeframe": timeframe,
            "signal_time_ms": t, "label_end_ms": end,
            "direction": item["direction"], "net_r": value,
            "signal_features": item["signal_features"],
            "model_plan_version": PLAN_VERSION,
            "source_data_version": DATA_VERSION,
        })
    for start in range(0, len(rows), 200):
        db("POST", "ai_paper_outcomes",
           params={"on_conflict": "symbol,strategy,timeframe,signal_time_ms,direction,model_plan_version,source_data_version"},
           payload=rows[start:start + 200],
           extra={"Prefer": "resolution=ignore-duplicates,return=minimal"})
    return len(rows)


def load_settled_outcomes(db, *, symbol, strategy, timeframe, asof_ms,
                          limit=10000):
    """Read only labels settled strictly before the training decision time."""
    if not 1 <= limit <= 10000:
        raise ValueError("invalid outcome read limit")
    rows = db("GET", "ai_paper_outcomes", params={
        "select": "signal_time_ms,label_end_ms,direction,net_r,signal_features",
        "symbol": "eq." + symbol, "strategy": "eq." + strategy,
        "timeframe": "eq." + timeframe,
        "model_plan_version": "eq." + PLAN_VERSION,
        "source_data_version": "eq." + DATA_VERSION,
        "label_end_ms": "lt." + str(asof_ms),
        "order": "signal_time_ms.asc,direction.asc",
        "limit": str(limit),
    })
    return sorted(rows, key=lambda x: (x["signal_time_ms"], x["direction"]))
