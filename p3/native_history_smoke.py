"""Read-only P3B native-history pipeline smoke run.

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
Runs without generated trades; this validates data plumbing, NOT AI returns.
"""
import json
import os

def main():
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
    from collector import db
    from p3.native_history_replay import replay_native_history
    from p3.multi_model_replay import STRATEGY_TIMEFRAMES
    requested = os.getenv("P3B_SYMBOL")
    if requested is not None and requested not in ("BTCUSDT", "ETHUSDT"):
        raise SystemExit("Unsupported P3B_SYMBOL")
    symbols = (requested,) if requested else ("BTCUSDT", "ETHUSDT")
    for symbol in symbols:
        result = replay_native_history(
            db, symbol, {strategy: {} for strategy in STRATEGY_TIMEFRAMES}
        )
        report = {
            strategy: {
                "candles_processed": len(result[strategy]["equity_curve"]),
                "closed_trades": result[strategy]["metrics"]["closed_trades"],
                "final_equity": result[strategy]["metrics"]["final_mark_to_market_equity"],
            }
            for strategy in STRATEGY_TIMEFRAMES
        }
        print(json.dumps({"symbol": symbol, "pipeline_only_no_ai_decisions": True,
                          "strategies": report}, sort_keys=True))

if __name__ == "__main__":
    main()
