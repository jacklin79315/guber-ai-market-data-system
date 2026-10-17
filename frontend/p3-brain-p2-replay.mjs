import {approvedToSimulationProposal} from './p3-p2-bridge.mjs';
import {replayCandles} from './p2-replay.mjs';
// Read-only research bridge. Only explicit Brain APPROVE decisions become P2 proposals.
// Caller must supply chronological native closed candles and explicit cost assumptions.
export function replayBrainDecisions({candles,decisions,accountOptions={},costs}={}){
 if(!Array.isArray(candles)||!Array.isArray(decisions)||!costs||![costs.feeRate,costs.slippageRate].every(v=>Number.isFinite(v)&&v>=0))throw Error('invalid Brain replay inputs');
 const indices=new Map();
 for(const bar of candles){
  if(!bar||typeof bar.symbol!=='string'||typeof bar.timeframe!=='string'||!Number.isSafeInteger(bar.closeTime))throw Error('invalid replay candle');
  const key=bar.symbol+'|'+bar.timeframe;
  if(!indices.has(key))indices.set(key,[]);
  indices.get(key).push(bar.closeTime);
 }
 for(const [key,times] of indices){for(let i=1;i<times.length;i++)if(times[i]<=times[i-1])throw Error('nonchronological candle series: '+key)}
 const proposals=[],skipped=[];const seen=new Set();
 for(const decision of decisions){
  if(!decision||!['APPROVE','WAIT','REJECT'].includes(decision.action))throw Error('invalid Brain decision');
  if(decision.action!=='APPROVE'){skipped.push({action:decision.action,reason:decision.reason||null});continue}
  const p=decision.proposal;
  if(!p||!Number.isSafeInteger(p.decisionTime)||!p.marketSnapshot||!Number.isSafeInteger(p.marketSnapshot.asOfMs)||p.marketSnapshot.asOfMs>p.decisionTime)throw Error('invalid Brain decision timestamp');
  const times=indices.get(p.symbol+'|'+p.timeframe)||[];
  const decisionIndex=times.indexOf(p.decisionTime);
  if(decisionIndex<0)throw Error('decision must match an existing closed candle');
  if(seen.has(p.id))throw Error('duplicate approved proposal id');seen.add(p.id);
  proposals.push(approvedToSimulationProposal(decision,{decisionIndex}));
 }
 const result=replayCandles({candles,proposals,accountOptions,costs});
 return {...result,approvedCount:proposals.length,skippedCount:skipped.length,skipped};
}
