import {compareChallengerReplay} from './p4-challenger-comparison.mjs';
import {assessP4ResearchFeedback} from './p4-research-feedback.mjs';
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
// Evaluate each diagnostic hypothesis against the same fixed research parent.
// No OOS candles, mutation of the parent, or automatic model update.
export async function runP4PatternResearch({plan,parentVersion,parentParameters,candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},otherReplayOptions={},minClosedTrades=30}={}){
 if(plan?.schemaVersion!=='P4_PATTERN_EXPERIMENT_PLAN_V1'||!Array.isArray(plan.experiments)||typeof parentVersion!=='string'||!parentVersion||!Array.isArray(candles)||candles.length<2)throw Error('invalid P4 pattern research');
 const parent=validateTrainingParameters(parentParameters);
 const results=[];
 for(let i=0;i<plan.experiments.length;i++){
  const e=plan.experiments[i];
  if(e?.schemaVersion!=='P4_PATTERN_EXPERIMENT_V1'||e.status!=='RESEARCH_REPLAY_REQUIRED'||!['Entry','Reward'].includes(e.actor)||![-1,1].includes(e.direction)||typeof e.evidenceId!=='string'||!e.evidenceId)throw Error('invalid diagnostic experiment');
  const candidate=validateTrainingParameters(e.parameters);
  const differences=Object.keys(parent).filter(k=>parent[k]!==candidate[k]);
  if(differences.length!==1||differences[0]!==e.parameter||Math.sign(candidate[e.parameter]-parent[e.parameter])!==e.direction)throw Error('invalid diagnostic parameter delta');
  const challengerVersion=parentVersion+'-diagnostic-'+(i+1);
  const comparison=await compareChallengerReplay({candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions,champion:{version:parentVersion,parameters:parent},challenger:{version:challengerVersion,parameters:candidate},otherReplayOptions});
  const feedback=assessP4ResearchFeedback({comparison,minClosedTrades});
  results.push({evidenceId:e.evidenceId,auditFingerprint:e.auditFingerprint,actor:e.actor,parameter:e.parameter,direction:e.direction,challengerVersion,parameters:candidate,feedback,status:feedback.improvedInSameWindow?'RESEARCH_IMPROVEMENT_REQUIRES_OOS':'NO_RESEARCH_IMPROVEMENT',causalEffectVerified:false,independentValidation:false,promotionAllowed:false});
 }
 return {schemaVersion:'P4_PATTERN_RESEARCH_RESULT_V1',status:'RESEARCH_ONLY',parentVersion,results,independentValidation:false,promotionAllowed:false,appliedToModels:false};
}
