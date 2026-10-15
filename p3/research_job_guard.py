"""Database-backed exclusive research lease for one bounded training batch."""
import os
import uuid
from .ai_training_pipeline import _add_months, chronological_windows, DAY_MS
from .native_history_replay import load_native_candles
from .multi_model_replay import STRATEGY_TIMEFRAMES


def research_window(db, symbol, strategy, years):
    candles = load_native_candles(db, symbol, STRATEGY_TIMEFRAMES[strategy])
    if not candles:
        raise ValueError("no native candles for research lease")
    end_ms = ((int(candles[-1]["close_time"]) + 1) // DAY_MS) * DAY_MS
    return chronological_windows(_add_months(end_ms, -12 * years),
                                 years=years)["validation"]


def execute_with_lease(db, *, symbol, strategy, years, runner, lease_seconds=14400):
    """Claim before training; never run if another worker holds this window.

    The lease is longer than the 180-minute workflow timeout. The database
    token prevents a stale worker from completing a reclaimed job.
    """
    window = research_window(db, symbol, strategy, years)
    generation = int(os.getenv("TRAINING_GENERATION", "1"))
    token = str(uuid.uuid4())
    args = {"p_symbol": symbol, "p_strategy": strategy,
            "p_generation": generation,
            "p_validation_start_ms": int(window[0]),
            "p_validation_end_ms": int(window[1]),
            "p_owner_token": token, "p_lease_seconds": lease_seconds}
    result = db("POST", "rpc/claim_ai_research_job", payload=args)
    if result is not True:
        return {"status": "WAIT", "reason": "lease_not_acquired",
                "strategy": strategy, "generation": generation}
    final_status = "FAILED"
    try:
        outcome = runner(db, symbol=symbol, strategy=strategy, years=years)
        if outcome.get("status") == "BATCH_COMPLETE":
            if outcome.get("eligible_trials", 0) < 1:
                raise RuntimeError("no eligible training candidate; iteration cannot advance")
            final_status = "SUCCEEDED"
        elif outcome.get("status") == "WAIT":
            final_status = "CANCELLED"
        return outcome
    finally:
        finished = db("POST", "rpc/finish_ai_research_job",
                      payload={"p_owner_token": token, "p_status": final_status})
        if finished is not True:
            raise RuntimeError("research lease completion rejected or expired")
