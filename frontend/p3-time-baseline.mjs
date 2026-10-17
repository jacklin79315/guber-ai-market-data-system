import {applyExpertPatch} from './p3-contract.mjs';
// Research-only Time expert baseline; uses closed historical trades, not future outcomes.
export function estimateHoldingTimeBaseline({proposal,history,minSamples=10,maxSamples=100}={}){
 if(!proposal||!Number.isSafeInteger(proposal.decisionTime)||proposal.decisionTime<0||!['LONG','SHORT'].includes(proposal.side)||typeof proposal.symbol!=='string'||typeof proposal.timeframe!=='string'||!Array.isArray(history)||!Number.isSafeInteger(minSamples)||minSamples<1||!Number.isSafeInteger(maxSamples)||maxSamples<minSamples)throw Error('invalid time expert settings');
 const seen=new Set(),eligible=[];
 for(const h of history){
  if(!h||typeof h.id!=='string'||!h.id||seen.has(h.id)||!Number.isSafeInteger(h.decisionTime)||!Number.isSafeInteger(h.closedTime)||h.decisionTime<0||h.closedTime<=h.decisionTime||typeof h.symbol!=='string'||typeof h.timeframe!=='string'||!['LONG','SHORT'].includes(h.side))throw Error('invalid holding time sample');
  seen.add(h.id);
  if(h.closedTime>=proposal.decisionTime||h.symbol!==proposal.symbol||h.timeframe!==proposal.timeframe||h.side!==proposal.side)continue;
  eligible.push(h);
 }
 eligible.sort((a,b)=>b.closedTime-a.closedTime||a.id.localeCompare(b.id));const durations=eligible.slice(0,maxSamples).map(h=>h.closedTime-h.decisionTime).sort((a,b)=>a-b);
 if(durations.length<minSamples)return {action:'CONTINUE',patch:{expectedHoldingMs:({ '15m':900000,'1h':3600000,'4h':14400000,'1d':86400000 }[proposal.timeframe]||3600000),timeUncertainty:'INSUFFICIENT_HISTORY: fallback one timeframe bar, not a calibrated duration forecast; sample count '+durations.length},sampleCount:durations.length,confidence:'LOW'};
 const median=durations[Math.floor((durations.length-1)/2)];const low=durations[Math.floor((durations.length-1)*0.25)],high=durations[Math.floor((durations.length-1)*0.75)];
 return {action:'CONTINUE',patch:{expectedHoldingMs:median,timeUncertainty:'Historical holding duration baseline; '+durations.length+' completed same-symbol/side/timeframe trades; interquartile duration '+low+'-'+high+' ms; not calibrated'},sampleCount:durations.length,confidence:'UNVALIDATED'};
}
export function applyHoldingTimeBaseline({proposal,history,...options}={}){
 const result=estimateHoldingTimeBaseline({proposal,history,...options});return {...result,proposal:applyExpertPatch('time',proposal,result.patch)};
}
