// Aggregate independently reviewed expert responsibility without turning PnL into blame.
// This is an observational research input, NOT learned Brain weights or model updates.
import {DIAGNOSTIC_ACTORS} from './p4-independent-diagnosis.mjs';

export function summarizeP4ExpertReliability({records,minReviewed=30}={}){
 if(!Array.isArray(records)||!Number.isSafeInteger(minReviewed)||minReviewed<2)throw Error('invalid reliability research inputs');
 const counts=Object.fromEntries(DIAGNOSTIC_ACTORS.map(actor=>[actor,{actor,reviewed:0,sound:0,primaryFault:0,secondaryFault:0,unknown:0,unassessed:0}]));
 let reviewedEvents=0,unresolvedEvents=0;
 const outcomes=Object.fromEntries(['CLOSED','SHADOW','WAIT','RETURN'].map(outcome=>[outcome,{total:0,reviewed:0,unresolved:0}]));
 for(const record of records){
  const d=record?.diagnosis;
  if(d?.schemaVersion!=='P4_DIAGNOSIS_V1'||!Array.isArray(d.attribution)||!Array.isArray(d.unassessedActors)||typeof d.requiresReview!=='boolean'||record?.feedback?.schemaVersion!=='P4_FEEDBACK_V1')throw Error('invalid verified diagnostic record');
  if(!Object.hasOwn(outcomes,d.outcome))throw Error('invalid diagnostic outcome');
  outcomes[d.outcome].total++;
  const seen=new Set();
  for(const a of d.attribution){
   if(!DIAGNOSTIC_ACTORS.includes(a.actor)||seen.has(a.actor)||!['SOUND','FAULT','UNKNOWN'].includes(a.quality)||!['PRIMARY','SECONDARY','NONE'].includes(a.responsibility)||a.quality==='FAULT'&&a.responsibility==='NONE'||a.quality!=='FAULT'&&a.responsibility!=='NONE')throw Error('invalid actor attribution');
   seen.add(a.actor);
   const row=counts[a.actor];
   if(a.quality==='UNKNOWN'){row.unknown++;continue;}
   // Only independently completed reviews contribute to reliability research.
   if(d.requiresReview)continue;
   row.reviewed++;
   if(a.quality==='SOUND')row.sound++;
   if(a.quality==='FAULT'&&a.responsibility==='PRIMARY')row.primaryFault++;
   if(a.quality==='FAULT'&&a.responsibility==='SECONDARY')row.secondaryFault++;
  }
  for(const actor of d.unassessedActors){
   if(!DIAGNOSTIC_ACTORS.includes(actor)||seen.has(actor))throw Error('invalid unassessed actor');
   counts[actor].unassessed++;
  }
  if(d.requiresReview){unresolvedEvents++;outcomes[d.outcome].unresolved++;}
  else{
   outcomes[d.outcome].reviewed++;
   if(seen.size!==DIAGNOSTIC_ACTORS.length||d.unassessedActors.length!==0||[...seen].some(actor=>!DIAGNOSTIC_ACTORS.includes(actor)))throw Error('incomplete diagnosis marked reviewed');
   reviewedEvents++;
  }
 }
 const experts=Object.values(counts).map(row=>({...row,eligibleForWeightHypothesis:row.reviewed>=minReviewed,observedFaultFraction:row.reviewed>=minReviewed?(row.primaryFault+row.secondaryFault)/row.reviewed:null}));
 return {schemaVersion:'P4_EXPERT_RELIABILITY_RESEARCH_V1',status:experts.every(x=>x.eligibleForWeightHypothesis)?'REVIEWED_EVIDENCE_AVAILABLE':'INSUFFICIENT_REVIEWED_EVIDENCE',totalEvents:records.length,reviewedEvents,unresolvedEvents,outcomes,minReviewed,experts,marketConditioned:false,causalAttributionProven:false,weightChangeProposed:false,weightChangeApplied:false,independentValidation:false,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
