"""Read-only autonomous experiment scheduler: never train or promote from stale validation."""
from .experiment_history import authorize_next_validation


def plan_next_experiment(history, current_validation_windows):
    """Return per-strategy WAIT/READY decisions using saved Supabase audits.

    history: ai_training_runs rows sorted newest first, each with report JSON.
    current_validation_windows: mapping strategy -> [start_ms, end_ms]
    READY only permits a future candidate trial, not model promotion.
    """
    latest = {}
    for row in history:
        strategy = row.get("strategy")
        if strategy and strategy not in latest:
            latest[strategy] = row
    result = {}
    for strategy, row in latest.items():
        report = row.get("report") or {}
        audit = report.get("experiment_history") or {}
        previous = (report.get("comparison_context") or {}).get("validation_window")
        current = current_validation_windows.get(strategy)
        decision = authorize_next_validation(audit, previous, current)
        result[strategy] = {
            "status": "READY" if decision["authorized"] else "WAIT",
            "reason": decision["reason"],
            "params": decision.get("params") if decision["authorized"] else None,
            "previous_validation_window": previous,
            "current_validation_window": current,
            "auto_promote": False,
            "allow_holdout_selection": False,
        }
    return result


def load_schedule_from_supabase(db, symbol, *, years=2):
    """Calculate future validation windows from latest closed native bars."""
    from .ai_training_pipeline import chronological_windows, _add_months, DAY_MS
    from .multi_model_replay import STRATEGY_TIMEFRAMES
    rows = []
    offset = 0
    while True:
        page = db("GET", "ai_training_runs", {
            "select": "run_key,symbol,strategy,timeframe,lookback_years,report",
            "symbol": "eq." + symbol, "lookback_years": "eq." + str(years),
            "order": "run_key.desc", "limit": "500", "offset": str(offset),
        })
        rows.extend(page)
        if len(page) < 500:
            break
        offset += len(page)
    windows = {}
    for strategy, timeframe in STRATEGY_TIMEFRAMES.items():
        candles = db("GET", "raw_candles", {
            "select": "close_time", "source": "eq.BINANCE",
            "market": "eq.SPOT", "symbol": "eq." + symbol,
            "timeframe": "eq." + timeframe,
            "order": "close_time.desc", "limit": "1",
        })
        if not candles:
            windows[strategy] = None
            continue
        end = ((int(candles[0]["close_time"]) + 1) // DAY_MS) * DAY_MS
        start = _add_months(end, -12 * years)
        windows[strategy] = list(chronological_windows(start, years=years)["validation"])
    return {"symbol": symbol, "lookback_years": years,
            "history_rows": len(rows), "decisions": plan_next_experiment(rows, windows),
            "validation_windows": windows}
