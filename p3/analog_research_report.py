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
from p3.four_strategy_analog import STRATEGY_PLANS


def main():
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        raise SystemExit("Supabase credentials required")
    from collector import db
    symbol = os.getenv("ANALOG_SYMBOL", "BTCUSDT")
    strategy = os.getenv("ANALOG_STRATEGY", "FIFTEEN_TO_THIRTY_DAYS")
    if strategy not in STRATEGY_PLANS:
        raise SystemExit("Unsupported strategy")
    timeframe = STRATEGY_PLANS[strategy]["timeframe"]
    if symbol not in ("BTCUSDT", "ETHUSDT") or timeframe not in INTERVAL_MS:
        raise SystemExit("Unsupported research symbol/timeframe")
    evaluation_bars = int(os.getenv("ANALOG_EVALUATION_BARS", "90"))
    if not 20 <= evaluation_bars <= 200:
        raise SystemExit("Evaluation bars must be 20..200")
    # Fixed ex-ante plan: 2% stop, 3% target, one native bar hold.
    # Fees: 0.1% each leg; adverse slippage: 0.1% each leg.
    stop_pct, target_pct = 0.02, 0.03
    holding = STRATEGY_PLANS[strategy]["max_holding_bars"]
    fee_rate, slippage_rate = 0.001, 0.001
    from datetime import datetime, timezone
    asof_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    # Read a bounded native interval, not 100k+ rows for every job.
    start_ms = asof_ms - 2510 * INTERVAL_MS[timeframe]
    history = load_research_history(db, symbol, timeframe, asof_ms=asof_ms,
                                    start_ms=start_ms)
    # Bound computation for large 15m history without introducing look-ahead.
    snapshots, candles = history["snapshots"][-2500:], history["candles"]
    first_time = snapshots[0]["timestamp_ms"]
    candles = [c for c in candles if c["close_time"] >= first_time]
    if len(snapshots) < evaluation_bars + 100:
        raise SystemExit("Insufficient historical research snapshots")
    evaluation_start_ms = snapshots[-evaluation_bars]["timestamp_ms"]
    print(json.dumps({"status": "STARTED", "symbol": symbol, "strategy": strategy, "timeframe": timeframe,
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
                "realized_total_net_r", "max_closed_trade_drawdown_r",
                "profit_factor", "skipped_overlapping_candidates")
        }
        # Diagnostic distributions explain WHY conservative selection rejected trades.
        # They are descriptive, not validation or a basis for tuning on test data.
        valid_means = [x["net_expectancy_r"] for x in report["results"]
                       if x.get("net_expectancy_r") is not None]
        valid_bounds = [x["lower_bound_r"] for x in report["results"]
                        if x.get("lower_bound_r") is not None]
        counts = [x["sample_count"] for x in report["results"]]
        reports[direction]["diagnostics"] = {
            "sample_count_min": min(counts) if counts else None,
            "sample_count_max": max(counts) if counts else None,
            "average_sample_count": sum(counts) / len(counts) if counts else None,
            "average_historical_net_expectancy_r": sum(valid_means) / len(valid_means) if valid_means else None,
            "best_historical_lower_bound_r": max(valid_bounds) if valid_bounds else None,
            "missing_historical_outcome_estimates": len(counts) - len(valid_means),
        }
        # Summarize rejection causes without relaxing the frozen trade gate.
        reasons = Counter(x["reason"] for x in report["results"]
                          if x["decision"] == "WAIT")
        reports[direction]["wait_reason_rates"] = {
            reason: count / report["evaluations"]
            for reason, count in sorted(reasons.items())
        } if report["evaluations"] else {}
        reports[direction]["positive_historical_mean_count"] = sum(
            x.get("net_expectancy_r") is not None and x["net_expectancy_r"] > 0
            for x in report["results"])
        reports[direction]["positive_conservative_bound_count"] = sum(
            x.get("lower_bound_r") is not None and x["lower_bound_r"] > 0
            for x in report["results"])
        reports[direction]["wait_reasons"] = dict(Counter(
            x["reason"] for x in report["results"] if x["decision"] == "WAIT"))
    print(json.dumps({
        "status": "RESEARCH_COMPLETE", "symbol": symbol, "strategy": strategy, "timeframe": timeframe,
        "evaluation_start_ms": evaluation_start_ms,
        "features": list(DEFAULT_FEATURES),
        "fixed_plan": {"stop_pct": stop_pct, "target_pct": target_pct,
                       "max_holding_bars": holding, "fee_rate": fee_rate,
                       "slippage_rate": slippage_rate, "k": 100, "min_samples": 30},
        "directions": reports, "research_only": True,
        "auto_trade_enabled": False,
        "limitations": ["research only", "not model promotion",
                        "no live execution", "not annualized returns",
                        "overlapping candidate positions excluded per direction",
                        "research horizons are fixed hypotheses, not optimized or validated"]
    }, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()
