// P2 realized trade statistics. Open positions are intentionally excluded.
export function tradeMetrics(account){
 if(!account||!Array.isArray(account.closed)||!Number.isFinite(account.initialCapital)||account.initialCapital<=0)throw Error("invalid account");
 const trades=account.closed;
 let wins=0,losses=0,breakeven=0,grossProfit=0,grossLoss=0,netPnl=0,entryFees=0,exitFees=0,grossRealizedPnl=0;
 for(const t of trades){
  if(!Number.isFinite(t.pnl))throw Error("non-finite trade PnL");
  netPnl+=t.pnl;
  if(Number.isFinite(t.entryFee)&&Number.isFinite(t.exitFee)&&Number.isFinite(t.grossPnl)){
   if(t.entryFee<0||t.exitFee<0||Math.abs(t.grossPnl-t.entryFee-t.exitFee-t.pnl)>1e-7*Math.max(1,Math.abs(t.pnl)))throw Error('closed trade cost reconciliation failed');
   entryFees+=t.entryFee;exitFees+=t.exitFee;grossRealizedPnl+=t.grossPnl;
  }else if(t.entryFee!==undefined||t.exitFee!==undefined||t.grossPnl!==undefined)throw Error('incomplete closed trade cost fields');
  if(t.pnl>0){wins++;grossProfit+=t.pnl}
  else if(t.pnl<0){losses++;grossLoss+=-t.pnl}
  else breakeven++;
 }
 return {
  closedTrades:trades.length,wins,losses,breakeven,
  winRate:trades.length?wins/trades.length:null,
  netRealizedPnl:netPnl,
  grossRealizedPnl,entryFees,exitFees,totalFees:entryFees+exitFees,
  costLedgerCoverage:trades.filter(t=>Number.isFinite(t.entryFee)&&Number.isFinite(t.exitFee)&&Number.isFinite(t.grossPnl)).length,
  costLedgerComplete:trades.every(t=>Number.isFinite(t.entryFee)&&Number.isFinite(t.exitFee)&&Number.isFinite(t.grossPnl)),
  costLedgerNetDifference:trades.every(t=>Number.isFinite(t.entryFee)&&Number.isFinite(t.exitFee)&&Number.isFinite(t.grossPnl))?grossRealizedPnl-entryFees-exitFees-netPnl:null,
  realizedReturn:netPnl/account.initialCapital,
  grossProfit,grossLoss,
  profitFactor:grossLoss>0?grossProfit/grossLoss:null,
  averageTradePnl:trades.length?netPnl/trades.length:null,
  pendingOrders:account.pending?.length??0,
  openPositions:account.positions?.length??0,
  shadowOrders:account.shadowOrders?.length??0,
  shadowObservedBars:(account.shadowOrders||[]).reduce((n,s)=>n+(s.observations?.length||0),0),
  shadowAmbiguousBars:(account.shadowOrders||[]).reduce((n,s)=>n+(s.ambiguousBars?.length||0),0),
  shadowRevisitedEntry:(account.shadowOrders||[]).filter(s=>s.firstTouches?.entry!=null).length,
  shadowStatusCounts:(account.shadowOrders||[]).reduce((counts,s)=>{const key=s.counterfactualStatus||"NOT_OBSERVED";counts[key]=(counts[key]||0)+1;return counts}, {})
 };
}
