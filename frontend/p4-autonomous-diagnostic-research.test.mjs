import test from 'node:test';
import assert from 'node:assert/strict';
import {planAutonomousP4DiagnosticResearch,discoverAutonomousP4ResearchHypotheses,inspectPersistedP4DiagnosticReadiness,inspectPersistedP4ResearchRound,prioritizeP4DiagnosticEvidenceGaps,inspectP4DecisionInputCoverage,planP4EvidenceResearchTasks} from './p4-autonomous-diagnostic-research.mjs';
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
 assert.equal(result.results.champion.decisionInputs.totalEvents,0);
 assert.equal(result.results.champion.calibrationEligibility.eligible,0);
 assert.equal(result.results.champion.calibrationEligibility.ready,false);
 assert.equal(result.results.champion.calibrationResearch,null);
 assert.equal(result.results.champion.researchTasks.tasks[0].id,'COLLECT_DIAGNOSTIC_RECORDS');
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

test('unknown exploratory probability is an evidence gap, never automatic fault',()=>{
 const records=[{diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1'},evidence:{action:'APPROVE',proposalAtDecision:{winProbability:null,expectedValue:null},expertHistory:[]}}];
 const result=inspectP4DecisionInputCoverage({records});
 assert.equal(result.unknownProbability,1);
 assert.equal(result.unknownExpectedValue,1);
 assert.equal(result.approvedWithUnknownProbability,1);
 assert.equal(result.ordersEnabled,false);
 assert.equal(result.modelUpdateApplied,false);
});

test('research tasks target unknown probability without turning it into blame or orders',()=>{
 const records=[{diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',requiresReview:true,unassessedActors:['Win'],attribution:[]},evidence:{action:'APPROVE',proposalAtDecision:{winProbability:null,expectedValue:null},expertHistory:[]}}];
 const result=planP4EvidenceResearchTasks({records});
 assert.equal(result.tasks[0].id,'CALIBRATE_UNKNOWN_WIN_PROBABILITY');
 assert.equal(result.tasks[1].id,'AUDIT_UNKNOWN_EXPECTED_VALUE');
 assert.equal(result.tasks.some(t=>t.id==='COLLECT_WIN_CAUSAL_EVIDENCE'),true);
 assert.equal(result.ordersEnabled,false);
 assert.equal(result.modelUpdateApplied,false);
 assert.equal(result.championPromotionAllowed,false);
});

test('optional calibration contract reports blocked research for empty persisted artifacts',async()=>{
 const {defineP4CausalExperiment}=await import('./p4-causal-experiment.mjs');
 const contract=defineP4CausalExperiment({jobId:'persisted-round',kind:'WIN_PROBABILITY_CALIBRATION',hypothesis:'Evaluate later untouched validation decisions',train:{from:100,to:500,asOf:600},validation:{from:700,to:1100,asOf:1200},minimumSamples:30});
 const store={read:async()=>[]};
 const result=await inspectPersistedP4ResearchRound({store,jobId:'persisted-round',iteration:1,manifests:{CHAMPION_DIAGNOSTICS:{chunkCount:1},CHALLENGER_DIAGNOSTICS:{chunkCount:1}},calibrationContract:contract});
 assert.equal(result.results.champion.calibrationResearch.status,'BLOCKED_INSUFFICIENT_EVIDENCE');
 assert.equal(result.results.challenger.calibrationResearch.experiment,null);
 assert.equal(result.ordersEnabled,false);
});

test('reads actual round manifest champion/challenger keys',async()=>{
 const seen=[];
 const store={read:async({kind,manifest})=>{seen.push([kind,manifest.chunkCount]);return []}};
 const result=await inspectPersistedP4ResearchRound({store,jobId:'persisted-real-shape',iteration:1,manifests:{schemaVersion:1,champion:{chunkCount:4},challenger:{chunkCount:5}}});
 assert.deepEqual(seen,[['CHAMPION_DIAGNOSTICS',4],['CHALLENGER_DIAGNOSTICS',5]]);
 assert.equal(result.ordersEnabled,false);
});
