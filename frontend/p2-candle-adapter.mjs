// Pure, read-only conversion of Supabase raw_candles rows for P2 replay.
const intervals={"15m":900000,"1h":3600000,"4h":14400000,"1d":86400000};
export function adaptRawCandles(rows,{asOfMs=Date.now(),source="BINANCE",market="SPOT"}={}){
 if(!Array.isArray(rows)||!Number.isSafeInteger(asOfMs))throw Error("invalid candle input");
 const seen=new Set();
 return rows.map(r=>{
  if(!r||r.source!==source||r.market!==market||typeof r.symbol!=="string"||!r.symbol||!Object.hasOwn(intervals,r.timeframe))throw Error("unexpected candle market or interval");
  const duration=intervals[r.timeframe];
  if(!Number.isSafeInteger(r.open_time)||!Number.isSafeInteger(r.close_time)||r.close_time-r.open_time!==duration-1||r.close_time>=asOfMs)throw Error("invalid or unclosed candle time");
  const [open,high,low,close]=[r.open_price,r.high_price,r.low_price,r.close_price].map(v=>typeof v==="string"&&v.trim()!==""?Number(v):NaN);
  if(![open,high,low,close].every(v=>Number.isFinite(v)&&v>0)||low>high||open<low||open>high||close<low||close>high)throw Error("invalid candle OHLC");
  const key=[r.source,r.market,r.symbol,r.timeframe,r.open_time].join("|");
  if(seen.has(key))throw Error("duplicate raw candle");seen.add(key);
  return {symbol:r.symbol,timeframe:r.timeframe,closeTime:r.close_time,open,high,low,close};
 }).sort((a,b)=>a.closeTime-b.closeTime||a.symbol.localeCompare(b.symbol,"en")||a.timeframe.localeCompare(b.timeframe,"en"));
}
