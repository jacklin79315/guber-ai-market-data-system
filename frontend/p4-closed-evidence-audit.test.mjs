import test from 'node:test';
import assert from 'node:assert/strict';
import {auditP4ClosedEvidence} from './p4-closed-evidence-audit.mjs';
const row=(e)=>({diagnosis:{outcome:'CLOSED'},evidence:e});
test('counts all original calibration evidence fields without fabricating gaps',()=>{
 const a=auditP4ClosedEvidence([row({decisionTime:100,closedAt:200,realizedWin:false,proposalAtDecision:{winProbability:0.7}}),row({decisionTime:100,closedAt:null,realizedWin:true,proposalAtDecision:{winProbability:0.6}}),{diagnosis:{outcome:'WAIT'}}]);
 assert.equal(a.closed,2);assert.equal(a.validCloseTime,1);assert.equal(a.validOutcome,2);assert.equal(a.validProbability,2);assert.equal(a.calibrationReady,1);assert.equal(a.complete,false);
});
test('unresolved attribution does not erase verifiable closed evidence',()=>{
 const a=auditP4ClosedEvidence([{...row({decisionTime:100,closedAt:200,realizedWin:true,proposalAtDecision:{winProbability:0.4}}),diagnosis:{outcome:'CLOSED',requiresReview:true}}]);
 assert.equal(a.calibrationReady,1);assert.equal(a.modelUpdateApplied,false);
});

test('audit results are stable across serialized artifact readback',()=>{
 const records=[row({decisionTime:100,closedAt:200,realizedWin:false,proposalAtDecision:{winProbability:0.7}}),row({decisionTime:300,closedAt:400,realizedWin:true,proposalAtDecision:{winProbability:0.5}})];
 assert.deepEqual(auditP4ClosedEvidence(JSON.parse(JSON.stringify(records))),auditP4ClosedEvidence(records));
});

test('zero closed trades never qualifies as complete calibration evidence',()=>{const a=auditP4ClosedEvidence([{diagnosis:{outcome:'WAIT'}}]);assert.equal(a.closed,0);assert.equal(a.calibrationReady,0);assert.equal(a.complete,false)});
