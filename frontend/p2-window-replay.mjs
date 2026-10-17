import {replayCandles} from "./p2-replay.mjs";
// Fetch bounded historical windows sequentially and replay in chronological order.
// Never mix timeframes; enforce the caller's fixed as-of cutoff.
const durations={"15m":900000,"1h":3600000,"4h":14400000,"1d":86400000};
export async function replayHistoricalWindows({loadWindow,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,windowDays=7,proposals=[],costs}={}){
 if(typeof loadWindow!=="function"||typeof symbol!=="string"||!symbol||!Object.hasOwn(durations,timeframe)||!Number.isSafeInteger(fromOpenTime)||!Number.isSafeInteger(toOpenTime)||!Number.isSafeInteger(asOfMs)||fromOpenTime>toOpenTime||toOpenTime>=asOfMs||!Number.isInteger(windowDays)||windowDays<1||windowDays>7)throw Error("invalid replay window settings");
 const interval=durations[timeframe],span=windowDays*86400000;
 const candles=[];let lastClose=-1;let windows=0;
 for(let start=fromOpenTime;start<=toOpenTime;){
  const end=Math.min(toOpenTime,start+span-1);
  const page=await loadWindow({symbol,timeframe,fromOpenTime:start,toOpenTime:end,asOfMs});
  if(!Array.isArray(page))throw Error("invalid replay window response");
  for(const c of page){if(c?.symbol!==symbol||c.timeframe!==timeframe||!Number.isSafeInteger(c.closeTime)||c.closeTime<=lastClose||c.closeTime>=asOfMs||c.closeTime-interval+1<start||c.closeTime-interval+1>end)throw Error("overlapping or mismatched replay candle");lastClose=c.closeTime;candles.push(c)}
  windows++;start=end+1;
 }
 const replay=replayCandles({candles,proposals,costs});
 return {...replay,windowsLoaded:windows,historyCandleCount:candles.length};
}
