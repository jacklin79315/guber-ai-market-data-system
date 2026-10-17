import {analyzeEntryRewardHistory} from './p3-entry-reward-research.mjs';
import {applySimilarityProbability} from './p3-similarity-probability.mjs';
// Research-only three-expert chain. Features must be observed at each candidate's decision time.
export function analyzeEntryRewardProbabilityHistory({candles,tradeHistory,featureAtDecision,minSamples=30,neighbors=50,...entryRewardOptions}={}){
 if(!Array.isArray(tradeHistory)||typeof featureAtDecision!=='function')throw Error('historical trade samples and feature resolver required');
 const first=analyzeEntryRewardHistory({candles,...entryRewardOptions});const proposals=[],waits=[...first.waits];
 for(const proposal of first.proposals){
  const features=featureAtDecision({decisionTime:proposal.decisionTime,symbol:proposal.symbol,timeframe:proposal.timeframe,decisionIndex:candles.findIndex(b=>b.closeTime===proposal.decisionTime&&b.symbol===proposal.symbol&&b.timeframe===proposal.timeframe)});
  if(!features||!Number.isSafeInteger(features.asOfMs)||features.asOfMs>proposal.decisionTime)throw Error('feature snapshot must be dated no later than decision');
  const result=applySimilarityProbability({proposal,features,history:tradeHistory,minSamples,neighbors});
  if(result.action==='WAIT'){waits.push({id:proposal.id,decisionTime:proposal.decisionTime,reason:result.reason});continue}
  proposals.push(result.proposal);
 }
 return {candleCount:first.candleCount,entryCandidateCount:first.entryCandidateCount,rewardProposalCount:first.partialProposalCount,probabilityWaitCount:waits.length-first.rewardWaitCount,partialProposalCount:proposals.length,proposals,waits,stage:'ENTRY_REWARD_PROBABILITY_ONLY',approvedCount:0};
}
