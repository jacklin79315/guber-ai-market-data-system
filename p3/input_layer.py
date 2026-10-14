"""P3A: point-in-time model input assembly; no trading rules or model predictions.

Each decision sees only candles with close_time <= decision_time.
Volatility classification uses the last 30 *completed daily* ATR percentages.
No synthetic candle resampling. Data gaps fail closed.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping, Sequence
import math

TIMEFRAMES = ("15m", "1h", "4h", "1d")
VOLATILITY_BANDS = ((5.0, "LOW"), (10.0, "MEDIUM"), (20.0, "HIGH"))
STRATEGIES = ("INTRADAY", "ONE_TO_THREE_DAYS", "ONE_WEEK", "FIFTEEN_TO_THIRTY_DAYS")


class InsufficientHistory(ValueError):
    pass


def _numeric(value, field):
    try:
        n = float(value)
    except (TypeError, ValueError) as exc:
        raise InsufficientHistory(f"missing/invalid {field}") from exc
    if not math.isfinite(n):
        raise InsufficientHistory(f"non-finite {field}")
    return n


def classify_volatility(daily_rows: Sequence[Mapping], decision_time_ms: int) -> dict:
    """Use 30 latest fully closed daily ATR% values; never include an open day."""
    eligible = sorted(
        (r for r in daily_rows if int(r["close_time"]) <= decision_time_ms),
        key=lambda r: int(r["close_time"]),
    )
    if len(eligible) < 30:
        raise InsufficientHistory("need 30 closed daily ATR observations")
    last = eligible[-30:]
    if len({int(r["open_time"]) for r in last}) != 30:
        raise InsufficientHistory("duplicate daily observations")
    values = [_numeric(r.get("atr_percent"), "atr_percent") for r in last]
    if any(v < 0 for v in values):
        raise InsufficientHistory("negative ATR%")
    avg = sum(values) / 30
    band = next((name for threshold, name in VOLATILITY_BANDS if avg < threshold), "EXTREME")
    return {"band": band, "atr_percent_30d_mean": avg, "observations": 30,
            "as_of_close_time": int(last[-1]["close_time"])}


def assemble_observation(
    symbol: str,
    decision_time_ms: int,
    rows_by_timeframe: Mapping[str, Sequence[Mapping]],
    *,
    asset_metadata: Mapping | None = None,
) -> dict:
    """One point-in-time snapshot shared by four independently trained models.

    Rows are from market_features; all timeframes must contain closed observations.
    Unknown market cap/liquidity are explicitly missing, not invented.
    """
    latest = {}
    for tf in TIMEFRAMES:
        rows = rows_by_timeframe.get(tf, ())
        eligible = [r for r in rows if int(r["close_time"]) <= decision_time_ms]
        if not eligible:
            raise InsufficientHistory(f"no closed {tf} features")
        row = max(eligible, key=lambda r: int(r["close_time"]))
        if row.get("symbol") != symbol or row.get("timeframe") != tf:
            raise ValueError(f"symbol/timeframe mismatch: {tf}")
        latest[tf] = row
    volatility = classify_volatility(rows_by_timeframe["1d"], decision_time_ms)
    meta = dict(asset_metadata or {})
    return {
        "symbol": symbol,
        "decision_time_ms": decision_time_ms,
        "decision_time_utc": datetime.fromtimestamp(decision_time_ms / 1000, tz=timezone.utc).isoformat(),
        "volatility": volatility,
        "asset_metadata": {
            "market_cap_usd": meta.get("market_cap_usd"),
            "liquidity": meta.get("liquidity"),
            "as_of_time_ms": meta.get("as_of_time_ms"),
        },
        "timeframes": {
            tf: {k: v for k, v in row.items() if k not in ("id", "collected_at")}
            for tf, row in latest.items()
        },
    }
