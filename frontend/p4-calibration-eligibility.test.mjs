import test from 'node:test';
import assert from 'node:assert/strict';
import {checkP4CalibrationEligibility} from './p4-calibration-eligibility.mjs';
test('empty evidence is not training-ready',()=>{const x=checkP4CalibrationEligibility([]);assert.equal(x.ready,false);assert.equal(x.eligible,0);assert.equal(x.promotionAllowed,false)});
test('incomplete closed event is excluded',()=>{const x=checkP4CalibrationEligibility([{diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',outcome:'CLOSED',requiresReview:true},feedback:{schemaVersion:'P4_FEEDBACK_V1',requiresReview:true},evidence:{decisionTime:100}}]);assert.equal(x.excluded.unresolved,1);assert.equal(x.ready,false)});
