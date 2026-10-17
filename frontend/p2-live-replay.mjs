import {createSupabaseCandlePageFetcher,loadHistoricalCandles} from "./p2-historical-reader.mjs";
import {replayHistoricalStream} from "./p2-stream-replay.mjs";
const intervals={"15m":900000,"1h":3600000,"4h":14400000,"1d":86400000};
// Backend-only, read-only historical replay. Never expose the supplied API key.
export async function runSupabaseHistoricalReplay({supabaseUrl,apiKey,fetchImpl=fetch,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs=Date.now(),windowDays=7,costs,proposals=[],accountOptions={}}={}){
 const duration=intervals[timeframe];
 if(!duration||typeof symbol!=="string"||!/^[A-Z0-9]{3,30}$/.test(symbol)||![fromOpenTime,toOpenTime,asOfMs].every(Number.isSafeInteger)||fromOpenTime<0||toOpenTime<fromOpenTime||toOpenTime+duration>asOfMs||!Number.isInteger(windowDays)||windowDays<1||windowDays>7||!costs)throw Error("invalid live replay parameters");
 const fetchPage=createSupabaseCandlePageFetcher({supabaseUrl,anonKey:apiKey,fetchImpl});
 return replayHistoricalStream({symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,windowDays,costs,proposals,accountOptions,requireContiguous:true,loadWindow:q=>loadHistoricalCandles({...q,fetchPage,pageSize:1000})});
}
