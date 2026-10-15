"""Manually triggered, read-only BTC/ETH historical analog research report.

Fixed plan, chronological out-of-sample evaluation. No training, orders,
database writes, or model promotion. Output is descriptive research only.
"""
import json
import os
from collections import Counter
from p3.analog_data_loader import load_research_history, DEFAULT_FEATURES
from p3.analog_walk_forward import walk_forward_analog_evaluation
from p3.raw_candle_adapter import INTERVAL_MS


def main():
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        raise SystemExit("Supabase credentials required")
    from collector import db
    symbol = os.getenv("ANALOG_SYMBOL", "BTCUSDT")
    timeframe = os.getenv("ANALOG_TIMEFRAME", "1d")
    if symbol not in ("BTCUSDT", "ETHUSDT") or timeframe not in INTERVAL_MS:
        raise SystemExit("Unsupported research symbol/timeframe")
    evaluation_bars = int(os.getenv("ANALOG_EVALUATION_BARS", "90"))
    if not 20 <= evaluation_bars <= 200:
        raise SystemExit("Evaluation bars must be 20..200")
    # Fixed ex-ante plan: 2% stop, 3% target, one native bar hold.
    # Fees: 0.1% each leg; adverse slippage: 0.1% each leg.
    stop_pct, target_pct, holding = 0.02, 0.03, 1
    fee_rate, slippage_rate = 0.001, 0.001
    from datetime import datetime, timezone
    asof_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    history = load_research_history(db, symbol, timeframe, asof_ms=asof_ms)
    snapshots, candles = history["snapshots"], history["candles"]
    if len(snapshots) < evaluation_bars + 100:
        raise SystemExit("Insufficient historical research snapshots")
    evaluation_start_ms = snapshots[-evaluation_bars]["timestamp_ms"]
    print(json.dumps({"status": "STARTED", "symbol": symbol, "timeframe": timeframe,
                      "feature_rows": len(snapshots), "native_candles": len(candles),
                      "evaluation_bars": evaluation_bars,
                      "research_only": True, "auto_trade_enabled": False}), flush=True)
    reports = {}
    for direction in ("LONG", "SHORT"):
        report = walk_forward_analog_evaluation(
            snapshots, candles, DEFAULT_FEATURES,
            horizon_ms=INTERVAL_MS[timeframe] * holding,
            direction=direction, stop_pct=stop_pct, target_pct=target_pct,
            max_holding_bars=holding, fee_rate=fee_rate,
            slippage_rate=slippage_rate, k=100, min_samples=30,
            evaluation_start_ms=evaluation_start_ms)
        reports[direction] = {
            key: report[key] for key in (
                "evaluations", "candidate_count", "wait_count",
                "realized_candidate_count", "unresolved_candidate_count",
                "realized_net_expectancy_r", "realized_win_rate",
                "realized_total_net_r")
        }
        reports[direction]["wait_reasons"] = dict(Counter(
            x["reason"] for x in report["results"] if x["decision"] == "WAIT"))
    print(json.dumps({
        "status": "RESEARCH_COMPLETE", "symbol": symbol, "timeframe": timeframe,
        "evaluation_start_ms": evaluation_start_ms,
        "features": list(DEFAULT_FEATURES),
        "fixed_plan": {"stop_pct": stop_pct, "target_pct": target_pct,
                       "max_holding_bars": holding, "fee_rate": fee_rate,
                       "slippage_rate": slippage_rate, "k": 100, "min_samples": 30},
        "directions": reports, "research_only": True,
        "auto_trade_enabled": False,
        "limitations": ["research only", "not model promotion",
                        "no live execution", "not annualized returns",
                        "overlapping candidate positions excluded per direction"]
    }, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()
