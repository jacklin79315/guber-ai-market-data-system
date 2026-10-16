"""Standalone feature recovery. Run: python feature_repair.py [SYMBOL]

Safe to restart: feature_engine.sync() checks the latest stored feature and
recalculates only missing candles with a 1000-candle warm-up window.
No raw candle data is modified.
"""
import logging
import sys
import time
import collector
from feature_engine import sync

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("feature_repair")

def repair(symbol=None):
    failures = []
    for item in collector.active():
        if item["source"] != "BINANCE" or item["market"] != "SPOT":
            continue
        if symbol and item["symbol"] != symbol:
            continue
        for interval in item["intervals"]:
            if interval not in collector.INTERVAL_MS:
                continue
            try:
                count = sync(collector.db, item["symbol"], interval)
                log.info("REPAIR %s %s features=%s", item["symbol"], interval, count)
            except Exception:
                failures.append((item["symbol"], interval))
                log.exception("REPAIR failed %s %s", item["symbol"], interval)
            time.sleep(0.2)
    if failures:
        raise RuntimeError("Feature repair failed for: " + repr(failures))

if __name__ == "__main__":
    if len(sys.argv) > 2:
        raise SystemExit("Usage: python feature_repair.py [SYMBOL]")
    repair(sys.argv[1].upper() if len(sys.argv) == 2 else None)
