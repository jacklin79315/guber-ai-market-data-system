// Aggregate independently diagnosed expert feedback. Never silently apply pending ratings.
import {DIAGNOSTIC_ACTORS} from './p4-independent-diagnosis.mjs';
export function summarizeP4ExpertFeedback(rows){
 if(!Array.isArray(rows))throw Error('invalid diagnostic feedback rows');
 const experts=Object.fromEntries(DIAGNOSTIC_ACTORS.map(actor=>[actor,{positive:0,negative:0,weightedPositive:0,weightedNegative:0,unresolved:0}]));
 let reviewed=0,pending=0;
 for(const row of rows){
  const d=row?.diagnosis,f=row?.feedback;
  if(d?.schemaVersion!=='P4_DIAGNOSIS_V1'||f?.schemaVersion!=='P4_FEEDBACK_V1'||d.decisionId!==f.decisionId||f.appliedToModels!==false||!Array.isArray(f.feedback))throw Error('invalid diagnostic feedback');
  if(f.requiresReview)pending++;else reviewed++;
  for(const item of f.feedback){
   const tally=experts[item.actor];
   if(!tally||!['POSITIVE','NEGATIVE','NONE'].includes(item.direction)||!Number.isFinite(item.weight)||item.weight<0)throw Error('invalid expert feedback');
   if(item.direction==='POSITIVE'){tally.positive++;tally.weightedPositive+=item.weight}
   else if(item.direction==='NEGATIVE'){tally.negative++;tally.weightedNegative+=item.weight}
   else tally.unresolved++;
  }
 }
 return {schemaVersion:'P4_EXPERT_FEEDBACK_SUMMARY_V1',events:rows.length,reviewed,pending,experts,appliedToModels:false,trainingEligible:false};
}
