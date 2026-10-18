// Deterministic research queue advice from persisted evidence, never model promotion.
// Explicitly distinguishes missing evidence from a negative OOS result.
export function decideP4DiagnosticNextAction(summary){
 if(!summary||typeof summary!=='object'||typeof summary.status!=='string'||!Array.isArray(summary.trainingResults))throw Error('invalid diagnostic research evidence');
 if(summary.ordersEnabled!==false||summary.modelUpdateApplied!==false||summary.championPromotionAllowed!==false)throw Error('unsafe diagnostic research evidence');
 const selected=summary.selectedArm;
 const status=summary.oosEvidenceStatus;
 if(!selected){
  return {action:'COLLECT_MORE_TRAIN_EVIDENCE',reason:'NO_ELIGIBLE_TRAIN_CHALLENGER',researchOnly:true,modelUpdateAllowed:false};
 }
 if(status==='INSUFFICIENT_OOS_SAMPLES'){
  return {action:'COLLECT_MORE_UNTOUCHED_OOS_EVIDENCE',reason:'OOS_SETTLED_TRADES_BELOW_THRESHOLD',researchOnly:true,modelUpdateAllowed:false};
 }
 if(status==='OOS_NOT_IMPROVED'){
  return {action:'REVISE_HYPOTHESIS',reason:'SELECTED_CHALLENGER_DID_NOT_IMPROVE_OOS',researchOnly:true,modelUpdateAllowed:false};
 }
 if(status==='OOS_IMPROVED_RESEARCH_ONLY'){
  return {action:'REQUEST_INDEPENDENT_VALIDATION',reason:'RESEARCH_REPLAY_IS_NOT_INDEPENDENT_VALIDATION',researchOnly:true,modelUpdateAllowed:false};
 }
 if(status==='NOT_EVALUATED'){
  return {action:'INVESTIGATE_MISSING_OOS',reason:'SELECTED_ARM_WITHOUT_OOS_REPLAY',researchOnly:true,modelUpdateAllowed:false};
 }
 throw Error('unknown diagnostic OOS evidence status');
}
