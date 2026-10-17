import {scanEntryHistory} from './p3-entry-history-scan.mjs';
import {estimateRewardBaseline} from './p3-reward-baseline.mjs';
import {applyExpertPatch,createProposalContext} from './p3-contract.mjs';
// Research only: build Entry -> Reward partial proposals, never approve or submit orders.
export function analyzeEntryRewardHistory({candles,lookback=20,threshold=0.001,atrPeriod=14,stopAtr=1.5,targetAtr=3,feeRate,slippageRate,modelVersion='ENTRY_REWARD_BASELINE_V1',maxCandidates=10000}={}){
 if(!Array.isArray(candles)||!Number.isFinite(feeRate)||!Number.isFinite(slippageRate))throw Error('explicit trading costs required');
 const scan=scanEntryHistory({candles,lookback,threshold,maxCandidates});
 const proposals=[],waits=[];
 for(const candidate of scan.candidates){
  const historical=candles.slice(Math.max(0,candidate.decisionIndex-atrPeriod),candidate.decisionIndex+1);
  const context=createProposalContext({id:candidate.id,decisionTime:candidate.decisionTime,marketSnapshot:{asOfMs:candidate.decisionTime},modelVersion});
  const entry=applyExpertPatch('entry',context,{symbol:candidate.symbol,side:candidate.side,timeframe:candidate.timeframe,entryRange:candidate.entryRange,entryReason:candidate.entryReason});
  const reward=estimateRewardBaseline({candidate,candles:historical,atrPeriod,stopAtr,targetAtr,feeRate,slippageRate});
  if(reward.action==='WAIT'){waits.push({id:candidate.id,decisionTime:candidate.decisionTime,reason:reward.reason});continue}
  const proposal=applyExpertPatch('reward',entry,reward.patch);
  proposals.push(proposal);
 }
 return {candleCount:scan.candleCount,entryCandidateCount:scan.candidateCount,entryWaitCount:scan.waitCount,rewardWaitCount:waits.length,partialProposalCount:proposals.length,proposals,waits,stage:'ENTRY_REWARD_ONLY',approvedCount:0};
}
