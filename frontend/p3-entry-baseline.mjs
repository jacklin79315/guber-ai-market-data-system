// Entry research baseline: closed-candle momentum breakout, no execution or synthetic outcomes.
const TF=new Set(['15m','1h','4h','1d']);
export function detectEntryCandidate({candles,lookback=20,threshold=0.001}={}){
 if(!Array.isArray(candles)||!Number.isSafeInteger(lookback)||lookback<3||lookback>200||!Number.isFinite(threshold)||threshold<0||threshold>0.1)throw Error('invalid entry settings');
 if(candles.length<lookback+1)return {action:'WAIT',reason:'INSUFFICIENT_CLOSED_CANDLES'};
 const bars=candles.slice(-(lookback+1));const symbol=bars[0]?.symbol,timeframe=bars[0]?.timeframe;
 if(typeof symbol!=='string'||!/^[A-Z0-9]{3,30}$/.test(symbol)||!TF.has(timeframe))throw Error('invalid entry market');
 for(let i=0;i<bars.length;i++){
  const b=bars[i];if(b.symbol!==symbol||b.timeframe!==timeframe||!Number.isSafeInteger(b.closeTime)||i&&b.closeTime<=bars[i-1].closeTime||![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||b.low>b.high||b.open<b.low||b.open>b.high||b.close<b.low||b.close>b.high)throw Error('invalid closed candle');
 }
 const previous=bars.slice(0,-1),last=bars.at(-1);
 const upper=Math.max(...previous.map(b=>b.high)),lower=Math.min(...previous.map(b=>b.low));
 const side=last.close>upper*(1+threshold)?'LONG':last.close<lower*(1-threshold)?'SHORT':null;
 if(!side)return {action:'WAIT',reason:'NO_CONFIRMED_BREAKOUT',decisionTime:last.closeTime};
 const price=last.close;
 return {action:'CANDIDATE',symbol,timeframe,side,decisionTime:last.closeTime,entryRange:[price,price],entryReason:'Closed-candle '+lookback+'-bar '+(side==='LONG'?'upside':'downside')+' breakout; threshold '+threshold,referenceRange:[lower,upper],baseline:'CLOSED_CANDLE_BREAKOUT_V1'};
}
