// P4 audit summary: diagnostic findings are NOT model updates.
// Preserve unresolved evidence instead of converting unknowns into rewards.
export function summarizeP4DiagnosticFeedback(rows){
 if(!Array.isArray(rows))throw Error('invalid diagnostic rows');
 const actors=Object.fromEntries(['Entry','Reward','Win','Risk','Time','Brain'].map(k=>[k,{positive:0,negative:0,unresolved:0,weightedPositive:0,weightedNegative:0}]));
 let requiresReview=0;
 const ids=new Set();
 for(const row of rows){
  const d=row?.diagnosis,f=row?.feedback;
  if(d?.schemaVersion!=='P4_DIAGNOSIS_V1'||f?.schemaVersion!=='P4_FEEDBACK_V1'||d.decisionId!==f.decisionId||ids.has(d.decisionId+'|'+d.outcome)||f.appliedToModels!==false)throw Error('invalid diagnostic feedback provenance');
  ids.add(d.decisionId+'|'+d.outcome);
  if(d.requiresReview)requiresReview++;
  for(const actor of d.unassessedActors??[]){if(!actors[actor])throw Error('unknown diagnostic actor');actors[actor].unresolved++}
  for(const item of f.feedback){
   const target=actors[item.actor];
   if(!target||!['POSITIVE','NEGATIVE','NONE'].includes(item.direction)||!Number.isFinite(item.weight)||item.weight<0)throw Error('invalid actor feedback');
   if(item.direction==='POSITIVE'){target.positive++;target.weightedPositive+=item.weight}
   else if(item.direction==='NEGATIVE'){target.negative++;target.weightedNegative+=item.weight}
   else target.unresolved++;
  }
 }
 return {schemaVersion:'P4_DIAGNOSTIC_AUDIT_V1',eventCount:rows.length,requiresReview,actors,appliedToModels:false,eligibleForAutonomousUpdate:false};
}
