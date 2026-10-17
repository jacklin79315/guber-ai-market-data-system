// P2 realized trade statistics. Open positions are intentionally excluded.
export function tradeMetrics(account){
 if(!account||!Array.isArray(account.closed)||!Number.isFinite(account.initialCapital)||account.initialCapital<=0)throw Error("invalid account");
 const trades=account.closed;
 let wins=0,losses=0,breakeven=0,grossProfit=0,grossLoss=0,netPnl=0;
 for(const t of trades){
  if(!Number.isFinite(t.pnl))throw Error("non-finite trade PnL");
  netPnl+=t.pnl;
  if(t.pnl>0){wins++;grossProfit+=t.pnl}
  else if(t.pnl<0){losses++;grossLoss+=-t.pnl}
  else breakeven++;
 }
 return {
  closedTrades:trades.length,wins,losses,breakeven,
  winRate:trades.length?wins/trades.length:null,
  netRealizedPnl:netPnl,
  realizedReturn:netPnl/account.initialCapital,
  grossProfit,grossLoss,
  profitFactor:grossLoss>0?grossProfit/grossLoss:null,
  averageTradePnl:trades.length?netPnl/trades.length:null,
  pendingOrders:account.pending?.length??0,
  openPositions:account.positions?.length??0,
  shadowOrders:account.shadowOrders?.length??0,
  shadowObservedBars:(account.shadowOrders||[]).reduce((n,s)=>n+(s.observations?.length||0),0),
  shadowAmbiguousBars:(account.shadowOrders||[]).reduce((n,s)=>n+(s.ambiguousBars?.length||0),0),
  shadowRevisitedEntry:(account.shadowOrders||[]).filter(s=>s.firstTouches?.entry!=null).length
 };
}
