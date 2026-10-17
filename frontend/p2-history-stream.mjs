// Memory-bounded validation and delivery of historical windows.
// Consumers may process each batch without accumulating the entire history.
const durations={"15m":900000,"1h":3600000,"4h":14400000,"1d":86400000};
export async function* iterateHistoricalWindows({loadWindow,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,windowDays=7,requireContiguous=false}={}){
 const duration=durations[timeframe];
 if(typeof loadWindow!=="function"||typeof symbol!=="string"||!symbol||!duration||![fromOpenTime,toOpenTime,asOfMs].every(Number.isSafeInteger)||fromOpenTime<0||fromOpenTime>toOpenTime||toOpenTime>=asOfMs||!Number.isInteger(windowDays)||windowDays<1||windowDays>7)throw Error("invalid historical stream settings");
 let lastClose=null;let expectedOpen=fromOpenTime;
 const span=windowDays*86400000;
 for(let start=fromOpenTime;start<=toOpenTime;){
  const end=Math.min(toOpenTime,start+span-1);
  const batch=await loadWindow({symbol,timeframe,fromOpenTime:start,toOpenTime:end,asOfMs});
  if(!Array.isArray(batch))throw Error("invalid historical stream batch");
  for(const bar of batch){
   const openTime=bar?.closeTime-duration+1;
   if(bar.symbol!==symbol||bar.timeframe!==timeframe||!Number.isSafeInteger(bar.closeTime)||openTime<start||openTime>end||bar.closeTime>=asOfMs||lastClose!==null&&bar.closeTime<=lastClose)throw Error("invalid historical stream order");
   if(requireContiguous&&openTime!==expectedOpen)throw Error("historical candle gap");
   lastClose=bar.closeTime;expectedOpen=openTime+duration;
  }
  yield batch;
  start=end+1;
 }
 if(requireContiguous&&expectedOpen!==toOpenTime+duration)throw Error("historical candle gap at end");
}
