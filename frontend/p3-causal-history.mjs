// Build causal training records only from already closed P2 trades and their archived decision features.
// No current/future market features may be substituted for historical snapshots.
export function buildCausalExpertHistory({closed,decisionArchive,asOfMs}={}){
 if(!Array.isArray(closed)||!(decisionArchive instanceof Map)||!Number.isSafeInteger(asOfMs)||asOfMs<0)throw Error('invalid causal history inputs');
 const tradeHistory=[],holdingHistory=[],seen=new Set();
 for(const trade of closed){
  if(!trade||typeof trade.id!=='string'||!trade.id||seen.has(trade.id))throw Error('invalid closed trade id');seen.add(trade.id);
  const snapshot=decisionArchive.get(trade.id);
  if(!snapshot)throw Error('missing archived decision features');
  const {decisionTime,features}=snapshot;
  if(!Number.isSafeInteger(decisionTime)||!Number.isSafeInteger(features?.asOfMs)||features.asOfMs>decisionTime||!Number.isSafeInteger(trade.closedTime)||trade.closedTime<=decisionTime)throw Error('invalid archived causal timestamps');
  if(trade.closedTime>=asOfMs)continue;
  if(!Number.isFinite(trade.pnl)||!['LONG','SHORT'].includes(trade.side)||typeof trade.symbol!=='string'||typeof trade.timeframe!=='string')throw Error('invalid closed trade outcome');
  const base={id:trade.id,decisionTime,closedTime:trade.closedTime,symbol:trade.symbol,timeframe:trade.timeframe,side:trade.side};
  holdingHistory.push(base);
  if(trade.pnl!==0)tradeHistory.push({...base,outcome:trade.pnl>0?'WIN':'LOSS',features:structuredClone(features)}); // Break-even informs holding time, not binary win probability.
 }
 return {tradeHistory,holdingHistory};
}

// P2 stores bar indices; resolve actual close timestamps from the same replay series.
export function attachClosedTimes({closed,candles}={}) {
 if(!Array.isArray(closed)||!Array.isArray(candles))throw Error('invalid P2 closed-time input');
 const series=new Map();
 for(const bar of candles){
  if(!bar||typeof bar.symbol!=='string'||typeof bar.timeframe!=='string'||!Number.isSafeInteger(bar.closeTime))throw Error('invalid P2 candle');
  const key=bar.symbol+'|'+bar.timeframe;
  if(!series.has(key))series.set(key,[]);
  const bars=series.get(key);
  if(bars.length&&bar.closeTime<=bars.at(-1).closeTime)throw Error('nonchronological P2 candle series');
  bars.push(bar);
 }
 return closed.map(t=>{
  const bars=series.get(t.symbol+'|'+t.timeframe);
  if(!Number.isSafeInteger(t.exitIndex)||t.exitIndex<0||!bars||t.exitIndex>=bars.length)throw Error('invalid P2 exit index or series');
  return {...t,closedTime:bars[t.exitIndex].closeTime};
 });
}
