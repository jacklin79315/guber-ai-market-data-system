import {diagnoseP4Decision,scoreP4DiagnosticFeedback} from './p4-independent-diagnosis.mjs';
import {assessP4ExpertHistory,assessP4RiskEvidence,assessP4ProposalInvariants} from './p4-rule-diagnostician.mjs';

// Read-only, deterministic reassessment of immutable historical evidence.
// Original diagnosis/feedback and stored artifacts are never mutated.
export function reassessP4PersistedDiagnostics({records}={}){
 if(!Array.isArray(records))throw Error('invalid persisted diagnostic records');
 const seen=new Set(),outcomes={CLOSED:0,SHADOW:0,WAIT:0,RETURN:0};
 const before={reviewed:0,unresolved:0},after={reviewed:0,unresolved:0};
 const addedByActor=Object.fromEntries(['Entry','Reward','Win','Risk','Time','Brain'].map(a=>[a,0]));
 const reassessments=[];
 for(const record of records){
  const old=record?.diagnosis,evidence=record?.evidence;
  if(old?.schemaVersion!=='P4_DIAGNOSIS_V1'||typeof old.decisionId!=='string'||!old.decisionId||!Object.hasOwn(outcomes,old.outcome)||!evidence||typeof evidence!=='object'||seen.has(old.decisionId))throw Error('invalid or duplicate persisted diagnostic evidence');
  seen.add(old.decisionId);outcomes[old.outcome]++;
  before[old.requiresReview?'unresolved':'reviewed']++;
  const event={outcome:old.outcome,evidence};
  const risk=assessP4RiskEvidence(event),proposal=assessP4ProposalInvariants(event),history=assessP4ExpertHistory(event);
  const newAssessments=[...risk,...proposal,...history].filter((a,i,arr)=>arr.findIndex(b=>b.actor===a.actor)===i);
  const previous=Array.isArray(old.attribution)?old.attribution:[];
  const combined=[...previous];
  for(const a of newAssessments){
   if(combined.some(b=>b.actor===a.actor))continue;
   combined.push(a);addedByActor[a.actor]++;
  }
  const diagnosis=diagnoseP4Decision({decisionId:old.decisionId,outcome:old.outcome,evidence,assessments:combined});
  after[diagnosis.requiresReview?'unresolved':'reviewed']++;
  reassessments.push({diagnosis,feedback:scoreP4DiagnosticFeedback(diagnosis)});
 }
 return {schemaVersion:'P4_PERSISTED_DIAGNOSTIC_REASSESSMENT_V1',mode:'RESEARCH_ONLY',sourceRecords:records.length,outcomes,before,after,addedByActor,modelUpdateApplied:false,ordersEnabled:false,championPromotionAllowed:false,reassessments};
}
