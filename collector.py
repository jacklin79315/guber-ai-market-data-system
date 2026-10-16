"""V1: native Binance Spot K-lines only. No indicators or synthetic candles."""
import os, time, json, logging, datetime as dt
from zoneinfo import ZoneInfo
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger("collector")
BASE = os.getenv("BINANCE_BASE_URL", "https://api.binance.com").rstrip("/")
SB = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEAD = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}
INTERVAL_MS = {"15m":900000, "1h":3600000, "4h":14400000, "1d":86400000}
SESSION = requests.Session()
# Reconcile abandoned jobs after hard stops without touching candle data.
# 24h is deliberately conservative for long historical backfills.
STALE_JOB_HOURS = 24
ACTIVE_JOB_IDS = set()
LAST_RECONCILE = 0

def reconcile_stale_jobs():
    """Close old RUNNING rows; never close a job active in this process."""
    cutoff = (dt.datetime.now(dt.timezone.utc) -
              dt.timedelta(hours=STALE_JOB_HOURS)).isoformat()
    params = {"status": "eq.RUNNING", "started_at": "lt." + cutoff,
              "select": "id", "limit": "1000"}
    candidates = db("GET", "ingestion_jobs", params)
    closed = 0
    for item in candidates:
        jid = item["id"]
        if jid in ACTIVE_JOB_IDS:
            continue
        # Compare-and-set: a completed row will not be changed.
        db("PATCH", "ingestion_jobs",
           {"id": "eq." + str(jid), "status": "eq.RUNNING",
            "started_at": "lt." + cutoff},
           {"status": "FAILED",
            "error_message": "AUTO_RECOVERY: stale RUNNING job; worker interrupted or heartbeat unavailable",
            "completed_at": dt.datetime.now(dt.timezone.utc).isoformat()},
           {"Prefer": "return=minimal"})
        closed += 1
    if closed:
        LOG.warning("stale ingestion jobs reconciled: %s", closed)
    return closed


def api(path, params):
    for attempt in range(5):
        try:
            r = SESSION.get(BASE + path, params=params, timeout=30)
            if r.status_code in (418,429) or r.status_code >= 500:
                time.sleep(min(60, 2**attempt * 3))
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            if attempt == 4: raise
            time.sleep(2**attempt)
    raise RuntimeError("Binance API unavailable")

def db(method, table, params=None, payload=None, extra=None):
    h = dict(HEAD)
    if extra: h.update(extra)
    r = SESSION.request(method, SB + "/" + table, params=params, json=payload, headers=h, timeout=45)
    r.raise_for_status()
    return r.json() if r.content else []

def server_ms():
    return int(api("/api/v3/time", {})["serverTime"])

def active():
    return db("GET","market_data_watchlist",{"select":"id,source,market,symbol,enabled,lookback_years,intervals,backfill_requested_at","enabled":"eq.true"})

def log_issue(sym, interval, ts, kind, expected=None, observed=None):
    db("POST","data_quality_issues",payload={"source":"BINANCE","market":"SPOT","symbol":sym,"timeframe":interval,"open_time":ts,"issue_type":kind,"expected_payload":expected,"observed_payload":observed},extra={"Prefer":"return=minimal"})

def job(sym, interval, kind):
    jid = db("POST","ingestion_jobs",payload={"job_type":kind,"symbol":sym,"timeframe":interval,"status":"RUNNING","started_at":dt.datetime.now(dt.timezone.utc).isoformat()},extra={"Prefer":"return=representation"})[0]["id"]
    ACTIVE_JOB_IDS.add(jid)
    return jid

def finish(jobid, status, inserted=0, duplicates=0, issues=0, error=None):
    try:
        db("PATCH","ingestion_jobs",{"id":"eq."+str(jobid)},{"status":status,"inserted_count":inserted,"duplicate_count":duplicates,"issue_count":issues,"error_message":error,"completed_at":dt.datetime.now(dt.timezone.utc).isoformat()},{"Prefer":"return=minimal"})
    finally:
        ACTIVE_JOB_IDS.discard(jobid)

def native_rows(sym, interval, start=None, limit=1000):
    p = {"symbol":sym,"interval":interval,"limit":limit}
    if start is not None: p["startTime"]=start
    return api("/api/v3/klines",p)

def convert(sym, interval, row):
    if len(row) != 12: raise ValueError("Unexpected Binance kline schema")
    return dict(source="BINANCE",market="SPOT",symbol=sym,timeframe=interval,
      open_time=int(row[0]),open_price=str(row[1]),high_price=str(row[2]),
      low_price=str(row[3]),close_price=str(row[4]),base_volume=str(row[5]),
      close_time=int(row[6]),quote_volume=str(row[7]),trade_count=int(row[8]),
      taker_buy_base_volume=str(row[9]),taker_buy_quote_volume=str(row[10]),
      ignore_value=str(row[11]))

FIELDS = ["open_price","high_price","low_price","close_price","base_volume","close_time","quote_volume","trade_count","taker_buy_base_volume","taker_buy_quote_volume","ignore_value"]
def save(sym, interval, rows, now):
    valid = [convert(sym,interval,r) for r in rows if int(r[6]) < now]
    if not valid: return (0,0,0)
    valid.sort(key=lambda r:r["open_time"])
    keys = [r["open_time"] for r in valid]
    if len(keys)!=len(set(keys)): raise ValueError("Duplicate open_time from source")
    lo, hi = keys[0], keys[-1]
    existing = db("GET","raw_candles",{"select":"open_time,"+",".join(FIELDS),"source":"eq.BINANCE","market":"eq.SPOT","symbol":"eq."+sym,"timeframe":"eq."+interval,"open_time":"gte."+str(lo),"and":"(open_time.lte."+str(hi)+")","limit":"1000"})
    old = {int(x["open_time"]):x for x in existing}
    fresh=[]; duplicates=0; issues=0
    for r in valid:
        prev=old.get(r["open_time"])
        if prev is None: fresh.append(r)
        elif all(str(prev[k])==str(r[k]) for k in FIELDS): duplicates+=1
        else:
            issues+=1
            log_issue(sym,interval,r["open_time"],"SOURCE_CONFLICT",{k:prev[k] for k in FIELDS},{k:r[k] for k in FIELDS})
    if fresh:
        db("POST","raw_candles",{"on_conflict":"source,market,symbol,timeframe,open_time"},fresh,{"Prefer":"resolution=ignore-duplicates,return=minimal"})
    return (len(fresh),duplicates,issues)

def run_recent(sym, interval):
    jid=job(sym,interval,"RECENT_SYNC")
    try:
        now=server_ms()
        # Fetch 101 so a forming final bar never reduces the closed-bar target below 100.
        rows=native_rows(sym,interval,limit=101)
        closed=[r for r in rows if int(r[6])<now][-100:]
        a,b,c=save(sym,interval,closed,now)
        finish(jid,"SUCCEEDED",a,b,c)
        LOG.info("recent %s %s inserted=%s duplicate=%s issues=%s",sym,interval,a,b,c)
        return True
    except Exception as e:
        finish(jid,"FAILED",error=str(e)[:2000]); LOG.exception("recent %s %s",sym,interval)
        return False

def run_backfill(sym, interval, years, kind):
    jid=job(sym,interval,kind); a=b=c=0
    try:
        now=server_ms()
        start_dt=dt.datetime.fromtimestamp(now/1000,dt.timezone.utc)
        try: start_dt=start_dt.replace(year=start_dt.year-years)
        except ValueError: start_dt=start_dt.replace(year=start_dt.year-years,day=28)
        cursor=int(start_dt.timestamp()*1000)
        step=INTERVAL_MS[interval]
        while cursor < now:
            rows=native_rows(sym,interval,start=cursor,limit=1000)
            if not rows: break
            closed=[r for r in rows if int(r[6])<now]
            if not closed: break
            x,y,z=save(sym,interval,closed,now); a+=x;b+=y;c+=z
            nxt=int(rows[-1][0])+step
            if nxt<=cursor: raise ValueError("Non-advancing source pagination")
            cursor=nxt
            time.sleep(0.15)
        finish(jid,"SUCCEEDED",a,b,c)
        LOG.info("%s %s %s inserted=%s duplicate=%s issues=%s",kind,sym,interval,a,b,c)
        return True
    except Exception as e:
        finish(jid,"FAILED",a,b,c,str(e)[:2000]); LOG.exception("%s %s %s",kind,sym,interval)
        return False

def completed_initial(sym, interval, requested_at):
    """Use durable successful jobs to resume initial backfills after restart."""
    rows=db("GET","ingestion_jobs",{
        "select":"id,completed_at",
        "symbol":"eq."+sym,
        "timeframe":"eq."+interval,
        "job_type":"eq.INITIAL_BACKFILL",
        "status":"eq.SUCCEEDED",
        "completed_at":"gte."+requested_at,
        "order":"completed_at.desc",
        "limit":"1",
    })
    return bool(rows)

def main():
    # In-memory scheduling state; all writes are idempotent, and full audits repeat daily.
    seen_add={}; last_recent=None; last_daily=None
    global LAST_RECONCILE
    while True:
        try:
            if time.monotonic() - LAST_RECONCILE >= 3600:
                reconcile_stale_jobs()
                LAST_RECONCILE = time.monotonic()
            local=dt.datetime.now(ZoneInfo("Asia/Taipei"))
            watch=active()
            for item in watch:
                if item["source"]!="BINANCE" or item["market"]!="SPOT": continue
                sym=item["symbol"]; intervals=[i for i in item["intervals"] if i in INTERVAL_MS]
                marker=(item["id"],item["backfill_requested_at"])
                if seen_add.get(item["id"])!=marker:
                    for interval in intervals:
                        if completed_initial(sym, interval, item["backfill_requested_at"]):
                            LOG.info("INITIAL_BACKFILL already completed %s %s", sym, interval)
                        else:
                            run_backfill(sym,interval,item["lookback_years"],"INITIAL_BACKFILL")
                    seen_add[item["id"]]=marker
            tick=(local.date().isoformat(),local.hour,local.minute//15)
            if local.minute%15==0 and tick!=last_recent:
                for item in watch:
                    if item["source"]=="BINANCE" and item["market"]=="SPOT":
                        for interval in item["intervals"]:
                            if interval in INTERVAL_MS: run_recent(item["symbol"],interval)
                last_recent=tick
            day=local.date().isoformat()
            if local.hour>=9 and day!=last_daily:
                for item in watch:
                    if item["source"]=="BINANCE" and item["market"]=="SPOT":
                        for interval in item["intervals"]:
                            if interval in INTERVAL_MS: run_backfill(item["symbol"],interval,item["lookback_years"],"DAILY_AUDIT")
                last_daily=day
        except Exception: LOG.exception("scheduler")
        time.sleep(30)

if __name__=="__main__": main()
