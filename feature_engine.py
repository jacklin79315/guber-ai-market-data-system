"""V2: copy native closed candles and compute fixed technical features."""
import logging, math
import numpy as np
import pandas as pd

LOG = logging.getLogger("features")
RAW = ["source","market","symbol","timeframe","open_time","open_price","high_price","low_price","close_price","base_volume","close_time","quote_volume","trade_count","taker_buy_base_volume","taker_buy_quote_volume","ignore_value"]
NUM = ["open_price","high_price","low_price","close_price","base_volume"]
WINDOW = 1000
BATCH = 250

def _safe_div(a,b):
    return a / b.replace(0,np.nan) if isinstance(b,pd.Series) else a / (b if b else np.nan)

def _rsi(c,n):
    d=c.diff()
    up=d.clip(lower=0).ewm(alpha=1/n,adjust=False,min_periods=n).mean()
    down=(-d.clip(upper=0)).ewm(alpha=1/n,adjust=False,min_periods=n).mean()
    r=100-100/(1+_safe_div(up,down))
    return r.mask((down==0)&(up>0),100).mask((down==0)&(up==0),50)

def calculate(rows, first_index=0):
    d=pd.DataFrame(rows)
    for k in NUM: d[k]=pd.to_numeric(d[k],errors="raise")
    o,h,l,c,v=(d[k] for k in NUM)
    f={}
    for n in (20,50,100,200):
        f[f"sma_{n}"]=c.rolling(n,min_periods=n).mean()
        f[f"ema_{n}"]=c.ewm(span=n,adjust=False,min_periods=n).mean()
        f[f"sma_slope_{n}"]=f[f"sma_{n}"].pct_change(fill_method=None)
        f[f"ema_slope_{n}"]=f[f"ema_{n}"].pct_change(fill_method=None)
        f[f"price_sma_ratio_{n}"]=_safe_div(c,f[f"sma_{n}"])
        f[f"price_ema_ratio_{n}"]=_safe_div(c,f[f"ema_{n}"])
        f[f"distance_to_sma_{n}"]=_safe_div(c-f[f"sma_{n}"],f[f"sma_{n}"])*100
        f[f"distance_to_ema_{n}"]=_safe_div(c-f[f"ema_{n}"],f[f"ema_{n}"])*100
    for n in (6,12,24):
        f[f"rsi_{n}"]=_rsi(c,n)
        f[f"rsi_{n}_change"]=f[f"rsi_{n}"].diff()
        f[f"rsi_{n}_acceleration"]=f[f"rsi_{n}_change"].diff()
    macd=c.ewm(span=12,adjust=False,min_periods=12).mean()-c.ewm(span=26,adjust=False,min_periods=26).mean()
    sig=macd.ewm(span=9,adjust=False,min_periods=9).mean()
    f.update(macd=macd,macd_signal=sig,macd_histogram=macd-sig)
    for k in ("macd","macd_signal","macd_histogram"): f[k+"_change"]=f[k].diff()
    raw_k=_safe_div(c-l.rolling(9).min(),h.rolling(9).max()-l.rolling(9).min())*100
    f["stoch_k"]=raw_k.rolling(3,min_periods=3).mean()
    f["stoch_d"]=f["stoch_k"].rolling(3,min_periods=3).mean()
    tr=pd.concat([(h-l),(h-c.shift()).abs(),(l-c.shift()).abs()],axis=1).max(axis=1)
    atr=tr.ewm(alpha=1/14,adjust=False,min_periods=14).mean()
    f["atr_14"]=atr
    f["atr_percent"]=_safe_div(atr,c)*100
    up=h.diff(); down=-l.diff()
    pdm=up.where((up>down)&(up>0),0.0)
    mdm=down.where((down>up)&(down>0),0.0)
    pdi=_safe_div(pdm.ewm(alpha=1/14,adjust=False,min_periods=14).mean(),atr)*100
    mdi=_safe_div(mdm.ewm(alpha=1/14,adjust=False,min_periods=14).mean(),atr)*100
    dx=_safe_div((pdi-mdi).abs(),pdi+mdi)*100
    f["plus_di_14"]=pdi; f["minus_di_14"]=mdi
    f["adx_14"]=dx.ewm(alpha=1/14,adjust=False,min_periods=14).mean()
    mid=c.rolling(20,min_periods=20).mean()
    std=c.rolling(20,min_periods=20).std(ddof=0)
    f["bb_upper"]=mid+2*std; f["bb_middle"]=mid; f["bb_lower"]=mid-2*std
    f["bb_width"]=_safe_div(4*std,mid)*100
    f["bollinger_zscore"]=_safe_div(c-mid,std)
    for n in (20,50): f[f"volume_ma_{n}"]=v.rolling(n,min_periods=n).mean()
    f["volume_ratio"]=_safe_div(v,f["volume_ma_20"])
    f["candle_body"]=(c-o).abs()
    f["upper_wick"]=h-pd.concat([o,c],axis=1).max(axis=1)
    f["lower_wick"]=pd.concat([o,c],axis=1).min(axis=1)-l
    rng=h-l
    for k,num in (("body_ratio",f["candle_body"]),("upper_wick_ratio",f["upper_wick"]),("lower_wick_ratio",f["lower_wick"])):
        f[k]=_safe_div(num,rng)
    for n in (1,3,5,10): f[f"return_{n}"]=c.pct_change(n,fill_method=None)
    result=[]
    for i in range(len(rows)):
        if first_index+i<200: continue
        row={k:rows[i][k] for k in RAW}
        for k,series in f.items():
            value=series.iloc[i]
            row[k]=float(value) if pd.notna(value) and math.isfinite(float(value)) else None
        result.append(row)
    return result

def sync(db,sym,interval):
    """Incrementally calculate after a successful native ingestion job."""
    params={"select":"open_time","source":"eq.BINANCE","market":"eq.SPOT","symbol":"eq."+sym,"timeframe":"eq."+interval,"order":"open_time.desc","limit":"1"}
    latest=db("GET","market_features",params)
    last=int(latest[0]["open_time"]) if latest else None
    q={"select":",".join(RAW),"source":"eq.BINANCE","market":"eq.SPOT","symbol":"eq."+sym,"timeframe":"eq."+interval,"order":"open_time.asc","limit":"1000"}
    if last is not None:
        # 1000-bar overlap provides deterministic smoothing convergence for incremental runs.
        prior=db("GET","raw_candles",{**q,"select":"open_time","open_time":"lte."+str(last),"order":"open_time.desc","limit":str(WINDOW)})
        if not prior: return 0
        q["open_time"]="gte."+str(min(int(r["open_time"]) for r in prior))
    rows=[]
    cursor=None
    while True:
        p=dict(q)
        if cursor is not None: p["open_time"]="gt."+str(cursor)
        batch=db("GET","raw_candles",p)
        if not batch: break
        rows.extend(batch)
        cursor=int(batch[-1]["open_time"])
        if len(batch)<1000: break
    if not rows: return 0
    if last is None:
        output=calculate(rows)
    else:
        output=[r for r in calculate(rows,first_index=200) if int(r["open_time"])>last]
    for i in range(0,len(output),BATCH):
        db("POST","market_features",{"on_conflict":"source,market,symbol,timeframe,open_time"},output[i:i+BATCH],{"Prefer":"resolution=merge-duplicates,return=minimal"})
    LOG.info("features %s %s inserted=%d",sym,interval,len(output))
    return len(output)
