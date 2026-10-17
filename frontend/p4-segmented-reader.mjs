import {planP4HistoricalWindows,verifyP4HistoricalWindows} from './p4-historical-windows.mjs';
import {loadHistoricalCandles,createSupabaseCandlePageFetcher} from './p2-historical-reader.mjs';
// Bounded, native-resolution, read-only segmented data loader. Does not train a model.
export async function loadP4SegmentedHistoricalCandles({supabaseUrl,apiKey,fetchImpl=fetch,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandlesPerWindow=10000,onProgress,shouldStop=()=>false}={}){
 if(typeof symbol!=='string'||!/^[A-Z0-9]{3,30}$/.test(symbol)||typeof shouldStop!=='function'||(onProgress!==undefined&&typeof onProgress!=='function'))throw Error('invalid P4 segmented source options');
 const plan=planP4HistoricalWindows({timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandlesPerWindow});
 const fetchPage=createSupabaseCandlePageFetcher({supabaseUrl,anonKey:apiKey,fetchImpl});
 const segments=[];let loaded=0;
 for(let i=0;i<plan.windows.length;i++){
  if(shouldStop())return {status:'STOPPED',plan,loadedCandles:loaded,completedWindows:i,verified:false};
  const w=plan.windows[i];
  const candles=await loadHistoricalCandles({fetchPage,symbol,timeframe,fromOpenTime:w.fromOpenTime,toOpenTime:w.toOpenTime,asOfMs});
  if(candles.length!==w.expectedCandles||candles.some(c=>c.symbol!==symbol||c.timeframe!==timeframe))throw Error('P4 segmented source coverage mismatch');
  segments.push(candles);loaded+=candles.length;
  if(onProgress)await onProgress({completedWindows:i+1,totalWindows:plan.windowCount,loadedCandles:loaded,expectedCandles:plan.expectedCandles});
 }
 const verification=verifyP4HistoricalWindows({plan,segments});
 return {status:'VERIFIED',plan,verification,candles:segments.flat(),loadedCandles:loaded,completedWindows:plan.windowCount,verified:true};
}
