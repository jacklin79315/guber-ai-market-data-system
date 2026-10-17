import {reviewBrainProposal} from './p3-brain-review.mjs';

// Research-only exploration Brain: probability is advisory, never fabricated.
// All structural, risk, and causal proposal safety checks remain mandatory.
export const RESEARCH_BRAIN_VERSION='P3_RULE_BRAIN_V2_EXPLORATION';
export async function researchRuleBrain(proposal){
 if(!proposal||typeof proposal!=='object')throw Error('invalid Brain proposal');
 const review=reviewBrainProposal(proposal);
 if(!review.ok)return {action:'WAIT',reason:'RULE_BRAIN_SAFETY:'+review.issues.join(',')};
 if(!Number.isFinite(proposal.riskReward)||proposal.riskReward<=0)
  return {action:'REJECT',reason:'RULE_BRAIN_INVALID_REWARD'};
 if(proposal.winProbability===null||proposal.expectedValue===null)
  return {action:'APPROVE',reason:'EXPLORATION_UNCALIBRATED_PROBABILITY_ADVISORY_ONLY'};
 if(!Number.isFinite(proposal.expectedValue))
  return {action:'WAIT',reason:'RULE_BRAIN_INVALID_EXPECTED_VALUE'};
 return {action:'APPROVE',reason:proposal.expectedValue>0?'EXPLORATION_POSITIVE_EV_ADVISORY':'EXPLORATION_NON_POSITIVE_EV_ADVISORY'};
}
