import test from 'node:test';
import assert from 'node:assert/strict';
import {defineP4CausalExperiment} from './p4-causal-experiment.mjs';
import {inspectP4CalibrationWindows} from './p4-calibration-window-eligibility.mjs';
const contract=defineP4CausalExperiment({jobId:'window-test',kind:'WIN_PROBABILITY_CALIBRATION',hypothesis:'Test past-only calibration on untouched later decisions',train:{from:100,to:500,asOf:600},validation:{from:700,to:1100,asOf:1200},minimumSamples:30});
const row=(decidedAt,closedAt)=>({diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',outcome:'CLOSED',requiresReview:false},feedback:{schemaVersion:'P4_FEEDBACK_V1',requiresReview:false},evidence:{decisionTime:decidedAt,closedAt,realizedWin:true,proposalAtDecision:{winProbability:0.6}}});
test('late training labels cannot pass chronological eligibility',()=>{
 const records=[...Array.from({length:30},(_,i)=>row(101+i,200+i)),...Array.from({length:30},(_,i)=>row(701+i,800+i))];
 assert.equal(inspectP4CalibrationWindows({records,contract}).ready,true);
 records[0]=row(101,650);
 const result=inspectP4CalibrationWindows({records,contract});
 assert.equal(result.ready,false);
 assert.equal(result.lateTrain,1);
});
test('missing validation samples never passes',()=>{
 const result=inspectP4CalibrationWindows({records:Array.from({length:30},(_,i)=>row(101+i,200+i)),contract});
 assert.equal(result.ready,false);
 assert.equal(result.validationCount,0);
});

test('tampered calibration contract is rejected before evidence check',()=>{
 const modified={...contract,minimumSamples:31};
 assert.throws(()=>inspectP4CalibrationWindows({records:[],contract:modified}),/modified calibration contract/);
});
