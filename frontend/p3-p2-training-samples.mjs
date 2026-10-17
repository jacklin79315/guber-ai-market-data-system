import {buildClosedTradeSamples} from './p3-trade-cohorts.mjs';
// Adapt P2 realized trades to P3 research samples. No shadow or cancelled orders.
export function p2ClosedToTrainingSamples({closed,candles,decisionContexts,cutoffMs}={}){
 if(!Array.isArray(closed)||!Array.isArray(candles)||!Array.isArray(decisionContexts)||!Number.isSafeInteger(cutoffMs)||cutoffMs<0)throw Error('invalid P2 training source');
 const series=new Map();
 for(const bar of candles){
  if(!bar||typeof bar.symbol!=='string'||typeof bar.timeframe!=='string'||!Number.isSafeInteger(bar.closeTime))throw Error('invalid source candle');
  const key=bar.symbol+'|'+bar.timeframe;
  if(!series.has(key))series.set(key,[]);
  const rows=series.get(key);
  if(rows.length&&rows[rows.length-1]>=bar.closeTime)throw Error('source candles not chronological');
  rows.push(bar.closeTime);
 }
 const contexts=new Map();
 for(const ctx of decisionContexts){
  if(!ctx||typeof ctx.id!=='string'||!ctx.id||contexts.has(ctx.id)||typeof ctx.marketState!=='string'||!Number.isSafeInteger(ctx.decisionTime))throw Error('invalid decision context');
  contexts.set(ctx.id,ctx);
 }
 const trades=closed.map(t=>{
  if(!t||t.state!=='CLOSED'||!Number.isSafeInteger(t.decisionIndex)||!Number.isSafeInteger(t.exitIndex)||!Number.isFinite(t.pnl))throw Error('invalid realized P2 trade');
  const timestamps=series.get(t.symbol+'|'+t.timeframe),ctx=contexts.get(t.id);
  if(!timestamps||!ctx||timestamps[t.decisionIndex]===undefined||timestamps[t.exitIndex]===undefined||ctx.decisionTime!==timestamps[t.decisionIndex]||t.exitIndex<=t.decisionIndex)throw Error('missing or mismatched trade timestamps');
  return {id:t.id,decisionTime:ctx.decisionTime,closedTime:timestamps[t.exitIndex],netPnl:t.pnl,marketState:ctx.marketState,side:t.side,timeframe:t.timeframe};
 });
 return buildClosedTradeSamples(trades,{cutoffMs});
}
