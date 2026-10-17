import {reviewBrainProposal} from './p3-brain-review.mjs';

// Deterministic, auditable P3 research Brain. NOT trained AI, never used as a
// substitute for the configured production inference Brain.
export const RESEARCH_BRAIN_VERSION='P3_RULE_BRAIN_V1';
export async function researchRuleBrain(proposal){
 if(!proposal||typeof proposal!=='object')throw Error('invalid Brain proposal');
 const review=reviewBrainProposal(proposal);
 if(!review.ok)return {action:'WAIT',reason:'RULE_BRAIN_SAFETY:'+review.issues.join(',')};
 if(proposal.winProbability===null||proposal.expectedValue===null)
  return {action:'WAIT',reason:'RULE_BRAIN_UNCALIBRATED_PROBABILITY'};
 if(!Number.isFinite(proposal.expectedValue)||proposal.expectedValue<=0)
  return {action:'REJECT',reason:'RULE_BRAIN_NON_POSITIVE_EV'};
 if(!Number.isFinite(proposal.riskReward)||proposal.riskReward<=0)
  return {action:'REJECT',reason:'RULE_BRAIN_INVALID_REWARD'};
 return {action:'APPROVE',reason:'RULE_BRAIN_POSITIVE_EV_AND_SAFETY_PASS'};
}
