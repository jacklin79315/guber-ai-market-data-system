import test from 'node:test';
import assert from 'node:assert/strict';
import {checkP4CalibrationEligibility} from './p4-calibration-eligibility.mjs';
test('empty evidence is not training-ready',()=>{const x=checkP4CalibrationEligibility([]);assert.equal(x.ready,false);assert.equal(x.eligible,0);assert.equal(x.promotionAllowed,false)});
test('incomplete closed event is excluded',()=>{const x=checkP4CalibrationEligibility([{diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',outcome:'CLOSED',requiresReview:true},feedback:{schemaVersion:'P4_FEEDBACK_V1',requiresReview:true},evidence:{decisionTime:100}}]);assert.equal(x.excluded.unresolved,1);assert.equal(x.ready,false)});

test('30 observations cannot satisfy two windows of 30 each',()=>{
 const records=Array.from({length:30},(_,i)=>({diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',outcome:'CLOSED',requiresReview:false},feedback:{schemaVersion:'P4_FEEDBACK_V1',requiresReview:false},evidence:{decisionTime:i*100+1,closedAt:i*100+2,realizedWin:i%2===0,proposalAtDecision:{winProbability:0.5}}}));
 const report=checkP4CalibrationEligibility(records,30);
 assert.equal(report.eligible,30);
 assert.equal(report.minimumForTwoWindows,60);
 assert.equal(report.ready,false);
});
