// P4 independent diagnostic contract v1. Quality is separate from realized PnL.
// No fixed 0-100 rating; explicit evidence and attributable feedback only.
export const DIAGNOSTIC_ACTORS=Object.freeze(['Entry','Reward','Win','Risk','Time','Brain']);
export function diagnoseP4Decision({decisionId,outcome,evidence,assessments}={}){
 if(typeof decisionId!=='string'||!decisionId||!['CLOSED','SHADOW','WAIT','RETURN'].includes(outcome)||!evidence||typeof evidence!=='object'||Array.isArray(evidence)||!Array.isArray(assessments))throw Error('invalid P4 diagnostic event');
 const seen=new Set();
 const attribution=assessments.map(a=>{
  if(!a||!DIAGNOSTIC_ACTORS.includes(a.actor)||seen.has(a.actor)||!['SOUND','FAULT','UNKNOWN'].includes(a.quality)||!['PRIMARY','SECONDARY','NONE'].includes(a.responsibility)||typeof a.reason!=='string'||!a.reason.trim()||!Array.isArray(a.evidenceKeys)||!a.evidenceKeys.length||a.evidenceKeys.some(k=>typeof k!=='string'||!Object.hasOwn(evidence,k))||a.quality==='UNKNOWN'&&a.responsibility!=='NONE'||a.quality==='SOUND'&&a.responsibility!=='NONE'||a.quality==='FAULT'&&a.responsibility==='NONE')throw Error('invalid P4 diagnostic attribution');
  seen.add(a.actor);
  return {actor:a.actor,quality:a.quality,responsibility:a.responsibility,reason:a.reason,evidenceKeys:[...a.evidenceKeys]};
 });
 return {schemaVersion:'P4_DIAGNOSIS_V1',decisionId,outcome,attribution,unassessedActors:DIAGNOSTIC_ACTORS.filter(a=>!seen.has(a)),requiresReview:attribution.length===0||attribution.some(a=>a.quality==='UNKNOWN')||seen.size<DIAGNOSTIC_ACTORS.length};
}
export function scoreP4DiagnosticFeedback(diagnosis){
 if(diagnosis?.schemaVersion!=='P4_DIAGNOSIS_V1'||!Array.isArray(diagnosis.attribution))throw Error('invalid P4 diagnosis');
 const weight={PRIMARY:2,SECONDARY:1,NONE:0};
 return {schemaVersion:'P4_FEEDBACK_V1',decisionId:diagnosis.decisionId,requiresReview:diagnosis.requiresReview,feedback:diagnosis.attribution.map(a=>({actor:a.actor,direction:a.quality==='FAULT'?'NEGATIVE':a.quality==='SOUND'?'POSITIVE':'NONE',responsibility:a.responsibility,weight:a.quality==='FAULT'?weight[a.responsibility]:a.quality==='SOUND'?1:0,reason:a.reason,evidenceKeys:a.evidenceKeys})),appliedToModels:false};
}
