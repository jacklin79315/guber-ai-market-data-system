// Evaluate a preregistered candidate without parameter search or champion promotion.
// Historical evaluation is NOT independent forward validation.
import {DEFAULT_TRAINING_PARAMETERS,validateTrainingParameters} from './p4-challenger-parameters.mjs';
import {replayP4DiagnosticArm} from './p4-diagnostic-arm-replay.mjs';
export const P4_LOCKED_ENTRY_CANDIDATE=Object.freeze({
 sourceJobId:'p4_diag_entry_multiscale_20261019_01',
 parameter:'entryLookback',from:20,to:17,direction:-1,
 evidenceType:'RETROSPECTIVE_HISTORICAL_ONLY',
 modelUpdateAllowed:false,championPromotionAllowed:false,ordersEnabled:false
});
export async function evaluateP4LockedEntryCandidate({confirm,candles,featureAtDecision,historyAtDecision,brain,costs,replay=replayP4DiagnosticArm}={}){
 if(confirm!=='RESEARCH_ONLY')throw Error('locked candidate requires research-only confirmation');
 if(!Array.isArray(candles)||candles.length<130||typeof brain!=='function'||typeof replay!=='function')throw Error('invalid locked candidate evaluation inputs');
 let prev=-Infinity;
 for(const candle of candles){
  if(!Number.isSafeInteger(candle?.closeTime)||candle.closeTime<=prev)throw Error('invalid chronological evaluation candles');
  prev=candle.closeTime;
 }
 const parent=validateTrainingParameters(DEFAULT_TRAINING_PARAMETERS);
 const arm={parameter:'entryLookback',from:20,to:17,direction:-1,parameters:validateTrainingParameters({...parent,entryLookback:17})};
 const result=await replay({taskId:'LOCKED_ENTRY_CANDIDATE_EVALUATION',arm,candles,featureAtDecision,historyAtDecision,brain,costs});
 return {schemaVersion:'P4_LOCKED_CANDIDATE_EVALUATION_V1',status:'RETROSPECTIVE_EVALUATED',sourceJobId:P4_LOCKED_ENTRY_CANDIDATE.sourceJobId,lockedCandidate:P4_LOCKED_ENTRY_CANDIDATE,window:{from:candles[0].closeTime,to:candles.at(-1).closeTime},feedback:result.feedback,comparison:result.comparison,independentValidation:false,modelUpdateAllowed:false,championPromotionAllowed:false,ordersEnabled:false};
}
