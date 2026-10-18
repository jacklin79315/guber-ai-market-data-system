import test from 'node:test';
import assert from 'node:assert/strict';
import {planP4DiagnosticResearchFollowUp} from './p4-diagnostic-research-task-plan.mjs';
const base={jobId:'p4_diag_entry_2000_20261019_01',loadedCandles:2000,status:'OOS_RESEARCH_EVALUATED',trainingResults:[],selectedArm:{parameter:'entryLookback',from:20,to:19},taskId:'COLLECT_ENTRY_CAUSAL_EVIDENCE',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
test('third-round insufficient OOS evidence proposes a non-executable research task',()=>{
 const r=planP4DiagnosticResearchFollowUp({...base,oosEvidenceStatus:'INSUFFICIENT_OOS_SAMPLES'});
 assert.equal(r.kind,'EXPAND_CAUSAL_EVIDENCE');
 assert.equal(r.requiresFreshNonOverlappingEvidence,true);
 assert.equal(r.sourceJobId,base.jobId);
 assert.equal(r.status,'PROPOSED_NOT_EXECUTED');
 assert.equal(r.autoExecutionAuthorized,false);
 assert.equal(r.ordersEnabled,false);
});
test('negative OOS result requests causal hypothesis review, not more blind tuning',()=>{
 const r=planP4DiagnosticResearchFollowUp({...base,oosEvidenceStatus:'OOS_NOT_IMPROVED'});
 assert.equal(r.kind,'INVESTIGATE_EXPERT_CAUSAL_ATTRIBUTION');
 assert.equal(r.championPromotionAllowed,false);
});
test('unsafe and unauditable plans are refused',()=>{
 assert.throws(()=>planP4DiagnosticResearchFollowUp({...base,ordersEnabled:true,oosEvidenceStatus:'OOS_NOT_IMPROVED'}),/unsafe/);
 assert.throws(()=>planP4DiagnosticResearchFollowUp({...base,jobId:'',oosEvidenceStatus:'OOS_NOT_IMPROVED'}),/auditable/);
});
