import {detectEntryCandidate} from './p3-entry-baseline.mjs';
// Offline candidate discovery only. Never submits P2 orders or reads future candles.
export function scanEntryHistory({candles,lookback=20,threshold=0.001,maxCandidates=10000}={}){
 if(!Array.isArray(candles)||!Number.isSafeInteger(maxCandidates)||maxCandidates<1||maxCandidates>100000)throw Error('invalid entry history scan');
 const candidates=[];let waitCount=0;
 for(let i=0;i<candles.length;i++){
  const result=detectEntryCandidate({candles:candles.slice(Math.max(0,i-lookback),i+1),lookback,threshold});
  if(result.action==='WAIT'){waitCount++;continue}
  if(candidates.length>=maxCandidates)throw Error('entry candidate limit exceeded');
  candidates.push({id:result.symbol+'|'+result.timeframe+'|'+result.decisionTime+'|'+result.side,decisionIndex:i,symbol:result.symbol,timeframe:result.timeframe,decisionTime:result.decisionTime,side:result.side,entryRange:result.entryRange,entryReason:result.entryReason,referenceRange:result.referenceRange,baseline:result.baseline});
 }
 return {candleCount:candles.length,candidateCount:candidates.length,waitCount,candidates};
}
