import test from 'node:test';
import assert from 'node:assert/strict';
import {planAutonomousP4DiagnosticResearch,discoverAutonomousP4ResearchHypotheses,inspectPersistedP4DiagnosticReadiness,inspectPersistedP4ResearchRound,prioritizeP4DiagnosticEvidenceGaps} from './p4-autonomous-diagnostic-research.mjs';
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

test('reads both diagnostic manifests without authorizing orders or model updates',async()=>{
 const seen=[];
 const store={read:async({kind,manifest})=>{seen.push([kind,manifest.chunkCount]);return []}};
 const result=await inspectPersistedP4ResearchRound({store,jobId:'test-round',iteration:1,manifests:{CHAMPION_DIAGNOSTICS:{chunkCount:2},CHALLENGER_DIAGNOSTICS:{chunkCount:3}}});
 assert.deepEqual(seen,[['CHAMPION_DIAGNOSTICS',2],['CHALLENGER_DIAGNOSTICS',3]]);
 assert.equal(result.results.champion.totalEvents,0);
 assert.equal(result.results.champion.evidenceGaps.totalEvents,0);
 assert.equal(result.results.champion.evidenceGaps.nextAction,'COLLECT_DIAGNOSTIC_EVIDENCE');
 assert.equal(result.results.challenger.totalEvents,0);
 assert.equal(result.ordersEnabled,false);
 assert.equal(result.modelUpdateApplied,false);
 assert.equal(result.championPromotionAllowed,false);
});
test('missing immutable manifest blocks persisted inspection',async()=>{
 await assert.rejects(()=>inspectPersistedP4ResearchRound({store:{read:async()=>[]},jobId:'test-round',iteration:1,manifests:{CHAMPION_DIAGNOSTICS:{}}}),/missing immutable diagnostic manifest/);
});

test('evidence gaps are ranked without inferring faults from losses',()=>{
 const records=[{diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',requiresReview:true,unassessedActors:['Entry','Reward','Brain'],attribution:[]}},{diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',requiresReview:true,unassessedActors:['Entry','Brain'],attribution:[]}}];
 const report=prioritizeP4DiagnosticEvidenceGaps({records});
 assert.equal(report.priorities[0].missing,2);
 assert.equal(report.priorities[0].actor,'Brain');
 assert.equal(report.priorities.find(x=>x.actor==='Entry').missing,2);
 assert.equal(report.nextAction,'IMPROVE_CAUSAL_EVIDENCE_COVERAGE');
 assert.equal(report.ordersEnabled,false);
});
