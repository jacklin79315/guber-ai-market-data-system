import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
// Only validated diagnostic evidence can nominate a parameter for the next research candidate.
// This is a planning interface, NOT automatic model training or Champion promotion.
const OWNERS=Object.freeze({Entry:['entryLookback','entryThreshold'],Reward:['rewardAtrPeriod','rewardStopAtr','rewardTakeAtr']});
export function planP4DiagnosticUpdate({parent,diagnosticFeedback,verified=false}={}){
 const parameters=validateTrainingParameters(parent);
 if(!Array.isArray(diagnosticFeedback)||typeof verified!=='boolean')throw Error('invalid diagnostic feedback batch');
 const blocked={status:'AWAITING_VALIDATED_DIAGNOSIS',parameters,proposedParameter:null,applied:false,reason:'Diagnostic attribution requires independent verification before a model update'};
 if(!verified||diagnosticFeedback.length===0)return blocked;
 const votes=new Map();
 for(const record of diagnosticFeedback){
  if(!record||record.schemaVersion!=='P4_FEEDBACK_V1'||record.requiresReview!==false||record.appliedToModels!==false||!Array.isArray(record.feedback))return blocked;
  for(const f of record.feedback){
   if(!f||!['POSITIVE','NEGATIVE','NONE'].includes(f.direction)||!Number.isFinite(f.weight)||f.weight<0||typeof f.actor!=='string')throw Error('invalid diagnostic vote');
   if(f.direction!=='NEGATIVE')continue;
   for(const key of OWNERS[f.actor]??[])votes.set(key,(votes.get(key)??0)+f.weight);
  }
 }
 if(!votes.size)return {status:'NO_ACTIONABLE_PARAMETER_FAULT',parameters,proposedParameter:null,applied:false,reason:'No validated parameter-owned negative attribution'};
 const ranking=[...votes].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 return {status:'DIAGNOSTIC_RESEARCH_PROPOSAL',parameters,proposedParameter:ranking[0][0],faultWeight:ranking[0][1],applied:false,reason:'Validated faults nominate a parameter for a separate controlled experiment; no direction or value is inferred'};
}
