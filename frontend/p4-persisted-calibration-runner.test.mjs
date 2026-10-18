import test from 'node:test';
import assert from 'node:assert/strict';
import {defineP4CausalExperiment} from './p4-causal-experiment.mjs';
import {runP4PersistedCalibrationResearch} from './p4-persisted-calibration-runner.mjs';
const contract=defineP4CausalExperiment({jobId:'calibration_test_1',kind:'WIN_PROBABILITY_CALIBRATION',hypothesis:'Evaluate prior Win probabilities against future settled labels',train:{from:100,to:500,asOf:600},validation:{from:700,to:1100,asOf:1200}});
const record=(t)=>({diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',outcome:'CLOSED',requiresReview:false},feedback:{schemaVersion:'P4_FEEDBACK_V1',requiresReview:false},evidence:{decisionTime:t,closedAt:t+1,realizedWin:t%2===0,proposalAtDecision:{winProbability:.6}}});
test('verified diagnostic records execute and persist a research-only calibration',async()=>{
 const records=[...Array.from({length:30},(_,i)=>record(101+i)),...Array.from({length:30},(_,i)=>record(701+i))];
 let saved=null;
 const summaryStore={load:async()=>saved,commit:async s=>{saved=s}};
 const args={confirm:'RESEARCH_ONLY',contract,sourceJobId:'original',iteration:1,manifest:{hash:'test'},artifactStore:{read:async()=>records},summaryStore,createdAtMs:123};
 const first=await runP4PersistedCalibrationResearch(args);
 assert.equal(first.status,'COMMITTED');assert.equal(first.summary.calibration.status,'RESEARCH_EXPERIMENT_COMPLETED');
 assert.equal(first.summary.championPromotionAllowed,false);assert.equal(first.summary.independentValidation,false);
 const second=await runP4PersistedCalibrationResearch({...args,artifactStore:{read:async()=>{throw Error('should not reread')}}});
 assert.equal(second.status,'ALREADY_COMMITTED');
 await assert.rejects(()=>runP4PersistedCalibrationResearch({...args,sourceJobId:'other'}),/conflicts/);
});
test('missing research authorization fails closed',async()=>{
 await assert.rejects(()=>runP4PersistedCalibrationResearch({confirm:'LIVE',contract}),/research-only/);
});
