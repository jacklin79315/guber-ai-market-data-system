import {loadHistoricalCandles,createSupabaseCandlePageFetcher} from './p2-historical-reader.mjs';
import {createSupabaseFeatureAtDecision} from './p3-supabase-feature-reader.mjs';
import {runP4ResearchCycle} from './p4-research-cycle.mjs';
const DURATIONS={'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};
// Read-only bounded P4 research source. A 24-month run must be explicitly segmented
// and independently validated; this adapter never silently truncates the requested range.
export async function runP4SupabaseResearchCycle({supabaseUrl,apiKey,fetchImpl=fetch,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandles=10000,featureAtDecision,historyAtDecision,brain,...cycleOptions}={}){
 const duration=DURATIONS[timeframe];
 if(!duration||typeof symbol!=='string'||!/^[A-Z0-9]{3,30}$/.test(symbol)||![fromOpenTime,toOpenTime,asOfMs].every(Number.isSafeInteger)||fromOpenTime<0||toOpenTime<fromOpenTime||fromOpenTime%duration!==0||toOpenTime%duration!==0||toOpenTime+duration>asOfMs||!Number.isSafeInteger(maxCandles)||maxCandles<2||maxCandles>10000)throw Error('invalid P4 historical interval');
 const expected=Math.floor((toOpenTime-fromOpenTime)/duration)+1;
 if(expected<2||expected>maxCandles)throw Error('P4 requested candle range exceeds explicit bound');
 const fetchPage=createSupabaseCandlePageFetcher({supabaseUrl,anonKey:apiKey,fetchImpl});
 const candles=await loadHistoricalCandles({fetchPage,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs});
 if(candles.length!==expected||candles.some((c,i)=>c.symbol!==symbol||c.timeframe!==timeframe||c.closeTime!==fromOpenTime+(i+1)*duration-1||c.closeTime>=asOfMs))throw Error('P4 historical candles missing or misaligned');
 if(featureAtDecision!==undefined)throw Error('P4 feature override not allowed');
 const featureReader=createSupabaseFeatureAtDecision({supabaseUrl,apiKey,fetchImpl});
 if(typeof brain!=='function')throw Error('explicit research Brain required');
 const result=await runP4ResearchCycle({...cycleOptions,candles,featureAtDecision:featureReader,historyAtDecision,brain});
 return {...result,source:'SUPABASE_READ_ONLY',symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,loadedCandles:candles.length};
}
