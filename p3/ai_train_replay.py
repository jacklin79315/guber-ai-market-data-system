"""End-to-end read-only AI train -> holdout decisions -> paper replay.

No model is trained on validation or holdout. Predictions are generated only
from features of already closed candles, then filled on the next native bar.
"""
import json
import os
from .ai_feature_history import load_native_features
from .native_history_replay import load_native_candles
from .ai_training_pipeline import train_horizon, EMBARGO_MS
from .multi_model_replay import STRATEGY_TIMEFRAMES
from .replay_runner import replay_with_metrics

def run_training(db, symbol, *, years=3, confidence_threshold=0.6):
    reports = {}
    for strategy, timeframe in STRATEGY_TIMEFRAMES.items():
        candles = load_native_candles(db, symbol, timeframe)
        features = load_native_features(db, symbol, timeframe)
        trained = train_horizon(features, candles, strategy, years=years)
        model = trained["model"]
        holdout_start, holdout_end = trained["windows"]["holdout"]
        # Embargo is enforced on decisions as well as training examples.
        earliest = holdout_start + EMBARGO_MS
        feature_by_close = {int(row["close_time"]): row for row in features}
        decisions = {}
        for candle in candles:
            t = int(candle["close_time"])
            if earliest <= t < holdout_end and t in feature_by_close:
                decisions[t] = model.decide(
                    symbol, feature_by_close[t],
                    confidence_threshold=confidence_threshold,
                )
        # Include one pre-holdout bar only if it cannot cause an entry.
        holdout_candles = [
            c for c in candles if earliest <= int(c["open_time"])
            and int(c["close_time"]) < holdout_end
        ]
        if len(holdout_candles) < 2:
            raise ValueError("insufficient holdout replay candles")
        outcome = replay_with_metrics(holdout_candles, decisions)
        metrics = outcome["metrics"]
        reports[strategy] = {
            "timeframe": timeframe,
            "training_samples": len(trained["partitions"]["train"]["X"]),
            "validation_samples": len(trained["partitions"]["validation"]["X"]),
            "holdout_label_samples": len(trained["partitions"]["holdout"]["X"]),
            "holdout_candles": len(holdout_candles),
            "decisions": {
                action: sum(d.action == action for d in decisions.values())
                for action in ("LONG", "SHORT", "WAIT")
            },
            "closed_trades": metrics["closed_trades"],
            "realized_net_pnl": metrics.get("realized_net_pnl"),
            "win_rate_percent": metrics.get("win_rate_percent"),
            "annualized_mark_to_market_return_percent": metrics.get(
                "annualized_mark_to_market_return_percent"),
            "max_close_to_close_drawdown_percent": metrics.get(
                "max_close_to_close_drawdown_percent"),
            "execution_path_uncertain": metrics["execution_path_uncertain"],
            "final_equity": metrics["final_mark_to_market_equity"],
            "holdout_start_ms": earliest,
            "holdout_end_ms": holdout_end,
        }
    return reports

def main():
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
    from collector import db
    symbol = os.getenv("P3_SYMBOL", "BTCUSDT")
    if symbol not in ("BTCUSDT", "ETHUSDT"):
        raise SystemExit("unsupported symbol")
    print(json.dumps({"status": "TRAINING_STARTED", "symbol": symbol}), flush=True)
    result = run_training(db, symbol)
    print(json.dumps({"status": "COMPLETE", "symbol": symbol, "models": result},
                     sort_keys=True, allow_nan=False), flush=True)

if __name__ == "__main__":
    main()
