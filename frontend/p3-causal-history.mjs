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
  if(trade.pnl===0)continue; // Break-even cannot be mislabeled WIN or LOSS.
  const base={id:trade.id,decisionTime,closedTime:trade.closedTime,symbol:trade.symbol,timeframe:trade.timeframe,side:trade.side};
  tradeHistory.push({...base,outcome:trade.pnl>0?'WIN':'LOSS',features:structuredClone(features)});
  holdingHistory.push(base);
 }
 return {tradeHistory,holdingHistory};
}
