// P4 read-only 24-month historical segmentation planner.
// Windows align to native Binance candle opens. No fabricated resampling or silent truncation.
const DURATIONS={'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};
export function planP4HistoricalWindows({timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandlesPerWindow=10000}={}){
 const duration=DURATIONS[timeframe];
 if(!duration||![fromOpenTime,toOpenTime,asOfMs].every(Number.isSafeInteger)||fromOpenTime<0||fromOpenTime%duration!==0||toOpenTime%duration!==0||toOpenTime<fromOpenTime||toOpenTime+duration>asOfMs||!Number.isSafeInteger(maxCandlesPerWindow)||maxCandlesPerWindow<2||maxCandlesPerWindow>10000)throw Error('invalid P4 historical window plan');
 const count=Math.floor((toOpenTime-fromOpenTime)/duration)+1;
 if(count>1000000)throw Error('P4 historical range exceeds planning safety bound');
 const windows=[];
 for(let start=fromOpenTime;start<=toOpenTime;start+=maxCandlesPerWindow*duration){
  const end=Math.min(toOpenTime,start+(maxCandlesPerWindow-1)*duration);
  windows.push({fromOpenTime:start,toOpenTime:end,expectedCandles:(end-start)/duration+1});
 }
 return {timeframe,fromOpenTime,toOpenTime,asOfMs,expectedCandles:count,windowCount:windows.length,windows};
}
export function verifyP4HistoricalWindows({plan,segments}={}){
 if(!plan||!Array.isArray(plan.windows)||!Array.isArray(segments)||segments.length!==plan.windows.length)throw Error('P4 historical segments incomplete');
 const duration=DURATIONS[plan.timeframe];
 if(!duration)throw Error('invalid P4 historical plan timeframe');
 let total=0,previousClose=-1;
 for(let i=0;i<segments.length;i++){
  const candles=segments[i],window=plan.windows[i];
  if(!Array.isArray(candles)||candles.length!==window.expectedCandles)throw Error('P4 historical segment missing candles');
  for(let j=0;j<candles.length;j++){
   const c=candles[j],expected=window.fromOpenTime+(j+1)*duration-1;
   if(c.timeframe!==plan.timeframe||c.closeTime!==expected||c.closeTime>=plan.asOfMs||c.closeTime<=previousClose)throw Error('P4 historical candle discontinuity');
   previousClose=c.closeTime;
  }
  total+=candles.length;
 }
 if(total!==plan.expectedCandles||previousClose!==plan.toOpenTime+duration-1)throw Error('P4 historical coverage mismatch');
 return {verified:true,loadedCandles:total,windowCount:segments.length,firstCloseTime:segments[0][0].closeTime,lastCloseTime:previousClose};
}
