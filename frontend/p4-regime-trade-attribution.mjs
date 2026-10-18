// Descriptive attribution by entry-time features. Research only; no model update.
export async function attributeP4ClosedTradesByRegime({closedTrades,decisions,featureAtDecision}={}){
 if(!Array.isArray(closedTrades)||!Array.isArray(decisions)||typeof featureAtDecision!=='function')throw Error('invalid regime attribution inputs');
 const byId=new Map(decisions.map(d=>[d.id,d]));
 if(byId.size!==decisions.length)throw Error('duplicate decisions');
 const groups=new Map();const seen=new Set();
 for(const trade of closedTrades){
  if(typeof trade.id!=='string'||seen.has(trade.id)||!Number.isFinite(trade.pnl)||!Number.isFinite(trade.totalFees))throw Error('invalid closed trade evidence');
  seen.add(trade.id);
  const decision=byId.get(trade.id);
  if(!decision||!Number.isSafeInteger(decision.decisionTime))throw Error('missing original entry decision');
  const parts=trade.id.split('|');
  if(parts.length<4)throw Error('invalid trade identity');
  const f=await featureAtDecision({candidate:{symbol:parts[0],timeframe:parts[1],decisionTime:decision.decisionTime}});
  if(!f||f.asOfMs>decision.decisionTime||!Number.isFinite(f.trendStrength)||!Number.isFinite(f.atrPercent))throw Error('invalid causal regime features');
  const trend=f.trendStrength>=25?'TREND':f.trendStrength<20?'RANGE':'TRANSITION';
  const volatility=f.atrPercent>=0.02?'HIGH_VOL':'NORMAL_VOL';
  const key=trend+'_'+volatility;
  const group=groups.get(key)||{regime:key,closedTrades:0,netPnl:0,fees:0,wins:0};
  group.closedTrades++;group.netPnl+=trade.pnl;group.fees+=trade.totalFees;if(trade.pnl>0)group.wins++;
  groups.set(key,group);
 }
 return {schemaVersion:'P4_REGIME_TRADE_ATTRIBUTION_V1',groups:[...groups.values()].sort((a,b)=>a.regime.localeCompare(b.regime)),attributedTrades:seen.size,method:'ENTRY_TIME_ADX_ATR',status:'DESCRIPTIVE_ONLY',independentValidation:false,championPromotionAllowed:false,ordersEnabled:false};
}
