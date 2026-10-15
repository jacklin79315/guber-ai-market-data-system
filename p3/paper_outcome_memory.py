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
        db("POST", "ai_paper_outcomes", payload=rows[start:start + 200],
           extra={"Prefer": "resolution=ignore-duplicates,return=minimal"})
    return len(rows)
