import {createHash} from 'node:crypto';
import {summarizeP4DiagnosticFeedback} from './p4-diagnostic-audit.mjs';
// Extract recurring, auditable invariant faults. This discovers hypotheses,
// not causal direction, statistical significance or a model update.
export function discoverP4DiagnosticPatterns({rows,minEvents=30}={}){
 if(!Array.isArray(rows)||!Number.isSafeInteger(minEvents)||minEvents<2)throw Error('invalid diagnostic pattern inputs');
 const audit=summarizeP4DiagnosticFeedback(rows);
 const groups=new Map();
 for(const row of rows){
  const d=row.diagnosis;
  for(const a of d.attribution){
   if(a.quality!=='FAULT'||!['PRIMARY','SECONDARY'].includes(a.responsibility))continue;
   const key=JSON.stringify([a.actor,a.responsibility,a.reason,[...a.evidenceKeys].sort()]);
   if(!groups.has(key))groups.set(key,{actor:a.actor,responsibility:a.responsibility,reason:a.reason,evidenceKeys:[...a.evidenceKeys].sort(),decisionIds:new Set(),outcomes:new Set()});
   const g=groups.get(key);g.decisionIds.add(d.decisionId);g.outcomes.add(d.outcome);
  }
 }
 const patterns=[...groups.values()].map(g=>{
  const decisionIds=[...g.decisionIds].sort(),supportingEvents=decisionIds.length;
  const evidenceId=createHash('sha256').update(JSON.stringify({auditFingerprint:audit.fingerprint,actor:g.actor,responsibility:g.responsibility,reason:g.reason,evidenceKeys:g.evidenceKeys,decisionIds})).digest('hex');
  return {schemaVersion:'P4_DIAGNOSTIC_PATTERN_V1',actor:g.actor,responsibility:g.responsibility,reason:g.reason,evidenceKeys:g.evidenceKeys,supportingEvents,evidenceId,outcomes:[...g.outcomes].sort(),status:supportingEvents>=minEvents?'HYPOTHESIS_FOR_CAUSAL_REVIEW':'INSUFFICIENT_PATTERN_SAMPLES',parameter:null,direction:null,causalFindingValidated:false,modelUpdated:false};
 }).sort((a,b)=>b.supportingEvents-a.supportingEvents||a.evidenceId.localeCompare(b.evidenceId));
 return {schemaVersion:'P4_DIAGNOSTIC_PATTERN_REPORT_V1',auditFingerprint:audit.fingerprint,totalEvents:audit.eventCount,unresolvedEvents:audit.requiresReview,minEvents,patterns,autonomousLearningReady:false,promotionAllowed:false};
}
