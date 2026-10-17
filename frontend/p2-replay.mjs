import {tradeMetrics} from "./p2-metrics.mjs";
import {equityMetrics} from "./p2-equity.mjs";
import {createAccount,submitProposal,processBar} from "./p2-simulator.mjs";

// Closed candles only. Equal-time symbols use a documented stable order.
export function replayCandles({candles,proposals=[],accountOptions={},costs}){
 if(!Array.isArray(candles)||!Array.isArray(proposals)||!costs)throw Error("invalid replay input");
 const sorted=[...candles].sort((a,b)=>a.closeTime-b.closeTime||a.symbol.localeCompare(b.symbol,"en")||a.timeframe.localeCompare(b.timeframe,"en"));
 const account=createAccount(accountOptions),cursor=new Map(),events=[],equitySnapshots=[];
 const seriesKey=b=>b.symbol+"|"+b.timeframe;
 const lengths=new Map();
 for(const b of sorted){
  if(!Number.isSafeInteger(b.closeTime)||b.closeTime<0)throw Error("invalid closeTime");
  const k=seriesKey(b);lengths.set(k,(lengths.get(k)||0)+1);
 }
 const proposalsByBar=new Map();
 for(const p of proposals){
  const k=seriesKey(p);
  if(!Number.isInteger(p.decisionIndex)||p.decisionIndex<0||p.decisionIndex>=(lengths.get(k)||0))throw Error("missing decision candle");
  const at=k+"|"+p.decisionIndex;
  proposalsByBar.set(at,[...(proposalsByBar.get(at)||[]),p]);
 }
 const seen=new Set();
 for(let candleIndex=0;candleIndex<sorted.length;candleIndex++){
  const b=sorted[candleIndex];
  const k=seriesKey(b),i=cursor.get(k)||0;
  if(seen.has(k+"|"+b.closeTime))throw Error("duplicate candle");
  seen.add(k+"|"+b.closeTime);
  const due=[...(proposalsByBar.get(k+"|"+i)||[])].sort((a,b)=>String(a.id).localeCompare(String(b.id),"en"));
  for(const p of due){
   const result=submitProposal(account,p);
   events.push({closeTime:b.closeTime,index:i,id:p.id,type:result.accepted?"SUBMITTED":"REJECTED",reason:result.reason||null});
  }
  for(const event of processBar(account,b,i,costs))events.push({...event,closeTime:b.closeTime,index:i});
  cursor.set(k,i+1);
  // Record after all symbols sharing the timestamp have been processed.
  const next=sorted[candleIndex+1];
  if(!next||next.closeTime!==b.closeTime)equitySnapshots.push({closeTime:b.closeTime,equity:account.equity,cash:account.cash,openPositions:account.positions.length});
 }
 return {account,events,metrics:tradeMetrics(account),equitySnapshots,equityMetrics:equityMetrics(equitySnapshots,account.initialCapital),processedCandles:sorted.length};
}
