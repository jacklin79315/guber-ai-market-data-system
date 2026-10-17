import {tradeMetrics} from "./p2-metrics.mjs";
import {equityMetrics} from "./p2-equity.mjs";
import {createAccount,submitProposal,processBar} from "./p2-simulator.mjs";

// Closed candles only. Equal-time symbols use a documented stable order.
export function createReplaySession({proposals=[],accountOptions={},costs}={}){
 if(!Array.isArray(proposals)||!costs)throw Error("invalid replay input");
 const account=createAccount(accountOptions),cursor=new Map(),events=[],equitySnapshots=[],seen=new Set(),lastClose=new Map();
 const seriesKey=b=>b.symbol+"|"+b.timeframe;
 const byBar=new Map();
 for(const p of proposals){if(!p||!Number.isInteger(p.decisionIndex)||p.decisionIndex<0||!p.symbol||!p.timeframe)throw Error("invalid proposal");const k=seriesKey(p)+"|"+p.decisionIndex;byBar.set(k,[...(byBar.get(k)||[]),p]);}
 let processedCandles=0,pendingSnapshotTime=null;
 function append(candles){
  if(!Array.isArray(candles))throw Error("invalid replay batch");
  for(const b of candles){
   if(!b||!Number.isSafeInteger(b.closeTime)||b.closeTime<0||typeof b.symbol!=="string"||typeof b.timeframe!=="string")throw Error("invalid closeTime");
   const k=seriesKey(b),i=cursor.get(k)||0;
   if(seen.has(k+"|"+b.closeTime)||lastClose.has(k)&&b.closeTime<=lastClose.get(k))throw Error("duplicate or out-of-order candle");
   if(pendingSnapshotTime!==null&&b.closeTime<pendingSnapshotTime)throw Error("out-of-order replay timestamp");
   if(pendingSnapshotTime!==null&&b.closeTime>pendingSnapshotTime){equitySnapshots.push({closeTime:pendingSnapshotTime,equity:account.equity,cash:account.cash,openPositions:account.positions.length});pendingSnapshotTime=null;}
   const due=[...(byBar.get(k+"|"+i)||[])].sort((a,b)=>String(a.id).localeCompare(String(b.id),"en"));
   for(const p of due){const result=submitProposal(account,p);events.push({closeTime:b.closeTime,index:i,id:p.id,type:result.accepted?"SUBMITTED":"REJECTED",reason:result.reason||null});}
   for(const event of processBar(account,b,i,costs))events.push({...event,closeTime:b.closeTime,index:i});
   cursor.set(k,i+1);lastClose.set(k,b.closeTime);seen.add(k+"|"+b.closeTime);processedCandles++;pendingSnapshotTime=b.closeTime;
  }
 }
 function finish(){
  if(pendingSnapshotTime!==null){equitySnapshots.push({closeTime:pendingSnapshotTime,equity:account.equity,cash:account.cash,openPositions:account.positions.length});pendingSnapshotTime=null;}
  for(const p of proposals){if(p.decisionIndex>=(cursor.get(seriesKey(p))||0))throw Error("missing decision candle");}
  return {account,events,metrics:tradeMetrics(account),equitySnapshots,equityMetrics:equityMetrics(equitySnapshots,account.initialCapital),processedCandles};
 }
 return {append,finish};
}
export function replayCandles({candles,proposals=[],accountOptions={},costs}){
 if(!Array.isArray(candles))throw Error("invalid replay input");
 const sorted=[...candles].sort((a,b)=>a.closeTime-b.closeTime||a.symbol.localeCompare(b.symbol,"en")||a.timeframe.localeCompare(b.timeframe,"en"));
 const session=createReplaySession({proposals,accountOptions,costs});session.append(sorted);return session.finish();
}
