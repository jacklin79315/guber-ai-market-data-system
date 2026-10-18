import test from 'node:test';
import assert from 'node:assert/strict';
import {planAutonomousP4DiagnosticResearch,discoverAutonomousP4ResearchHypotheses,inspectPersistedP4DiagnosticReadiness} from './p4-autonomous-diagnostic-research.mjs';
const parentParameters={entryLookback:20,entryThreshold:0.001,rewardAtrPeriod:14,rewardStopAtr:1.5,rewardTakeAtr:3};
test('autonomous research remains disabled for orders and promotion with no causal evidence',()=>{
 const audit={schemaVersion:'P4_DIAGNOSTIC_AUDIT_V1',eventCount:0,actors:{},appliedToModels:false,fingerprint:'a'.repeat(64),requiresReview:0};
 const result=planAutonomousP4DiagnosticResearch({audit,parentParameters,causalFindings:[]});
 assert.equal(result.mode,'RESEARCH_ONLY');
 assert.equal(result.ordersEnabled,false);
 assert.equal(result.liveTrading,false);
 assert.equal(result.championPromotionAllowed,false);
 assert.equal(result.modelUpdateApplied,false);
 assert.deepEqual(result.proposals,[]);
});

test('empty diagnostic evidence produces no actionable hypotheses or orders',()=>{
 const result=discoverAutonomousP4ResearchHypotheses({rows:[]});
 assert.equal(result.ordersEnabled,false);
 assert.equal(result.modelUpdateApplied,false);
 assert.equal(result.championPromotionAllowed,false);
 assert.deepEqual(result.hypotheses,[]);
 assert.deepEqual(result.pendingEvidence,[]);
});

test('persisted unresolved diagnoses cannot authorize learning',()=>{
 const row={diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',decisionId:'a',outcome:'CLOSED',requiresReview:true,attribution:[],unassessedActors:['Entry']},feedback:{schemaVersion:'P4_FEEDBACK_V1',decisionId:'a',appliedToModels:false,feedback:[]}};
 const result=inspectPersistedP4DiagnosticReadiness({records:[row]});
 assert.equal(result.reason,'UNRESOLVED_DIAGNOSIS');
 assert.equal(result.readyForCausalLearning,false);
 assert.equal(result.ordersEnabled,false);
});
test('fragment envelopes are rejected until integrity-checked reassembly',()=>{
 assert.throws(()=>inspectPersistedP4DiagnosticReadiness({records:[{__p4_fragment_v1:true}]}),/reconstructed/);
});
