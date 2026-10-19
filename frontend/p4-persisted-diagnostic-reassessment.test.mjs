import test from 'node:test';
import assert from 'node:assert/strict';
import {reassessP4PersistedDiagnostics} from './p4-persisted-diagnostic-reassessment.mjs';
const make=()=>({diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',decisionId:'btc|wait|1',outcome:'WAIT',attribution:[],requiresReview:true},evidence:{action:'WAIT',proposalAtDecision:{expectedValue:-0.002},expertHistory:[{expert:'riskPosition',action:'WAIT',reason:'NON_POSITIVE_EXPECTANCY'}]}});
test('reassesses immutable WAIT evidence without claiming full review',()=>{
 const original=make(),snapshot=structuredClone(original);
 const result=reassessP4PersistedDiagnostics({records:[original]});
 assert.deepEqual(original,snapshot);
 assert.equal(result.addedByActor.Risk,1);
 assert.equal(result.attributionAfter.Risk.sound,1);
 assert.equal(result.attributionAfter.Risk.fault,0);
 assert.equal(result.missingAfter.Risk,0);
 assert.equal(result.missingAfter.Brain,1);
 assert.equal(result.after.unresolved,1);
 assert.equal(result.reassessments[0].diagnosis.attribution[0].quality,'SOUND');
 assert.equal(result.reassessments[0].feedback.appliedToModels,false);
});
test('reassessment is idempotent and does not duplicate existing actor',()=>{
 const original=make();
 original.diagnosis.attribution=[{actor:'Risk',quality:'SOUND',responsibility:'NONE',reason:'previous guardrail check',evidenceKeys:['expertHistory']}];
 const result=reassessP4PersistedDiagnostics({records:[original]});
 assert.equal(result.addedByActor.Risk,0);
 assert.equal(result.reassessments[0].diagnosis.attribution.length,1);
});
test('duplicate historical decision IDs fail closed',()=>{
 assert.throws(()=>reassessP4PersistedDiagnostics({records:[make(),make()]}),/duplicate/);
});

test('outcome-specific coverage isolates shadow from closed and wait',()=>{
 const wait=make();
 const closed=make();
 closed.diagnosis.decisionId='closed-1';
 closed.diagnosis.outcome='CLOSED';
 closed.evidence={action:'APPROVE',accountAtDecision:{equity:100,committedCapital:20},allocation:10,proposalAtDecision:{expectedHoldingMs:1000}};
 const shadow=structuredClone(closed);
 shadow.diagnosis.decisionId='shadow-1';
 shadow.diagnosis.outcome='SHADOW';
 shadow.evidence.accountAtDecision={};
 const report=reassessP4PersistedDiagnostics({records:[wait,closed,shadow]});
 assert.equal(report.byOutcome.CLOSED.records,1);
 assert.equal(report.byOutcome.SHADOW.records,1);
 assert.equal(report.byOutcome.WAIT.records,1);
 assert.equal(report.byOutcome.RETURN.records,0);
 assert.equal(report.byOutcome.CLOSED.missingByActor.Risk,0);
 assert.equal(report.byOutcome.SHADOW.missingByActor.Risk,1);
 assert.equal(report.byOutcome.WAIT.missingByActor.Risk,0);
 assert.equal(Object.values(report.byOutcome).reduce((n,row)=>n+row.records,0),report.sourceRecords);
 assert.equal(Object.values(report.byOutcome).reduce((n,row)=>n+row.afterReviewed,0),report.after.reviewed);
 assert.equal(report.modelUpdateApplied,false);
 assert.equal(report.ordersEnabled,false);
});
