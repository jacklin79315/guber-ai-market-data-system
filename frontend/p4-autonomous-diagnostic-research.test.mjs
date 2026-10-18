import test from 'node:test';
import assert from 'node:assert/strict';
import {planAutonomousP4DiagnosticResearch} from './p4-autonomous-diagnostic-research.mjs';
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
