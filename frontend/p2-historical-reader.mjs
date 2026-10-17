import {adaptRawCandles} from "./p2-candle-adapter.mjs";
// Read-only Supabase PostgREST page loader. Caller supplies a configured fetch function.
// Keyset pagination avoids offset drift as new market rows arrive.
const allowedIntervals=new Set(["15m","1h","4h","1d"]);
export async function loadHistoricalCandles({fetchPage,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,pageSize=1000,source="BINANCE",market="SPOT"}){
 if(typeof fetchPage!=="function"||typeof symbol!=="string"||!/^[A-Z0-9]{3,30}$/.test(symbol)||!allowedIntervals.has(timeframe)||!Number.isSafeInteger(fromOpenTime)||!Number.isSafeInteger(toOpenTime)||fromOpenTime>toOpenTime||!Number.isSafeInteger(asOfMs)||fromOpenTime<0||toOpenTime<0||asOfMs<=toOpenTime||!Number.isInteger(pageSize)||pageSize<1||pageSize>1000)throw Error("invalid historical candle query");
 const result=[];let cursor=fromOpenTime-1;
 while(true){
  const rows=await fetchPage({source,market,symbol,timeframe,afterOpenTime:cursor,toOpenTime,limit:pageSize});
  if(!Array.isArray(rows)||rows.length>pageSize)throw Error("invalid historical page");
  if(!rows.length)break;
  let last=cursor;
  for(const row of rows){
   if(row?.source!==source||row.market!==market||row.symbol!==symbol||row.timeframe!==timeframe||!Number.isSafeInteger(row.open_time)||row.open_time<=last||row.open_time>toOpenTime)throw Error("out-of-order or mismatched historical page");
   last=row.open_time;
  }
  result.push(...adaptRawCandles(rows,{asOfMs,source,market}));cursor=last;
  if(rows.length<pageSize)break;
 }
 const duration={"15m":900000,"1h":3600000,"4h":14400000,"1d":86400000}[timeframe];
 for(let i=1;i<result.length;i++)if(result[i].closeTime-result[i-1].closeTime!==duration)throw Error('missing or overlapping historical candle interval');
 if(result.length&&result[0].closeTime!==fromOpenTime+duration-1)throw Error('missing historical start candle');
 if(result.length&&result.at(-1).closeTime!==toOpenTime+duration-1)throw Error('missing historical end candle');
 return result;
}
// Constructs an explicit read-only GET for a configured Supabase REST endpoint.
export function createSupabaseCandlePageFetcher({supabaseUrl,anonKey,fetchImpl=fetch}){
 if(typeof supabaseUrl!=="string"||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||typeof anonKey!=="string"||!anonKey||typeof fetchImpl!=="function")throw Error("invalid Supabase reader settings");
 return async ({source,market,symbol,timeframe,afterOpenTime,toOpenTime,limit})=>{
  const url=new URL("/rest/v1/raw_candles",supabaseUrl);
  for(const [k,v] of Object.entries({source,market,symbol,timeframe}))url.searchParams.set(k,"eq."+v);
  url.searchParams.set("open_time","gt."+afterOpenTime);
  url.searchParams.set("and", "(open_time.lte."+toOpenTime+")");
  url.searchParams.set("select","source,market,symbol,timeframe,open_time,close_time,open_price,high_price,low_price,close_price");
  url.searchParams.set("order","open_time.asc");url.searchParams.set("limit",String(limit));
  const response=await fetchImpl(url.toString(),{method:"GET",headers:{apikey:anonKey,Authorization:"Bearer "+anonKey,Accept:"application/json"}});
  if(!response.ok)throw Error("historical candle read failed: "+response.status);
  return response.json();
 };
}
