import test from 'node:test';
import assert from 'node:assert/strict';
import {defineP4CausalExperiment} from './p4-causal-experiment.mjs';
import {evaluateP4PersistedWinCalibration} from './p4-persisted-win-calibration.mjs';
const contract=defineP4CausalExperiment({jobId:'persisted-test',kind:'WIN_PROBABILITY_CALIBRATION',hypothesis:'Calibrate verified past-only decisions and test later labels',train:{from:100,to:500,asOf:600},validation:{from:700,to:1100,asOf:1200},minimumSamples:30});
const row=(t,c)=>({diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',outcome:'CLOSED',requiresReview:false},feedback:{schemaVersion:'P4_FEEDBACK_V1',requiresReview:false},evidence:{decisionTime:t,closedAt:c,realizedWin:t%2===0,proposalAtDecision:{winProbability:0.6}}});
test('missing persisted evidence blocks replay without model changes',()=>{
 const result=evaluateP4PersistedWinCalibration({records:[],contract});
 assert.equal(result.status,'BLOCKED_INSUFFICIENT_EVIDENCE');
 assert.equal(result.experiment,null);
 assert.equal(result.modelUpdateApplied,false);
 assert.equal(result.ordersEnabled,false);
});
test('verified chronological records run research-only calibration',()=>{
 const records=[...Array.from({length:30},(_,i)=>row(101+i,200+i)),...Array.from({length:30},(_,i)=>row(701+i,800+i))];
 const result=evaluateP4PersistedWinCalibration({records,contract});
 assert.equal(result.status,'RESEARCH_EXPERIMENT_COMPLETED');
 assert.equal(result.experiment.trainSamples,30);
 assert.equal(result.experiment.validationSamples,30);
 assert.equal(result.championPromotionAllowed,false);
});
test('late training label blocks experiment',()=>{
 const records=[...Array.from({length:30},(_,i)=>row(101+i,200+i)),...Array.from({length:30},(_,i)=>row(701+i,800+i))];
 records[0]=row(101,650);
 const result=evaluateP4PersistedWinCalibration({records,contract});
 assert.equal(result.status,'BLOCKED_INSUFFICIENT_EVIDENCE');
});
