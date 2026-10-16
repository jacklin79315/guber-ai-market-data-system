"""Run native collector and trigger V2 features after successful ingestion."""
import logging
import collector
from feature_engine import sync

log = logging.getLogger("worker")
_original_recent = collector.run_recent
_original_backfill = collector.run_backfill

def recent(symbol, interval):
    if not _original_recent(symbol, interval):
        return
    try:
        sync(collector.db, symbol, interval)
    except Exception:
        log.exception("Feature calculation failed for %s %s", symbol, interval)

def backfill(symbol, interval, years, kind):
    if not _original_backfill(symbol, interval, years, kind):
        return
    try:
        sync(collector.db, symbol, interval)
    except Exception:
        log.exception("Feature calculation failed for %s %s", symbol, interval)

collector.run_recent = recent
collector.run_backfill = backfill
collector.main()
