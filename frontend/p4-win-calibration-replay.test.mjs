import test from 'node:test';import assert from 'node:assert/strict';
import {defineP4CausalExperiment} from './p4-causal-experiment.mjs';
import {runP4WinCalibrationExperiment} from './p4-win-calibration-replay.mjs';
const contract=defineP4CausalExperiment({jobId:'calibration_replay',kind:'WIN_PROBABILITY_CALIBRATION',hypothesis:'Train-only bin calibration may improve Brier score',train:{from:100,to:500,asOf:600},validation:{from:700,to:1100,asOf:1200}});
const rows=[...Array.from({length:40},(_,i)=>({decidedAt:100+i*5,closedAt:101+i*5,probability:.8,outcome:i%2})),...Array.from({length:40},(_,i)=>({decidedAt:700+i*5,closedAt:701+i*5,probability:.8,outcome:i%2}))];
test('calibration uses train labels only and stays advisory',()=>{const r=runP4WinCalibrationExperiment({contract,observations:rows});assert.equal(r.status,'EVIDENCE_READY_FOR_INDEPENDENT_REVIEW');assert.ok(r.candidateBrier<r.baselineBrier);assert.equal(r.causalEffectProven,false);assert.equal(r.championPromotionAllowed,false);assert.equal(r.trainFingerprint.length,64)});
test('reject future-leaking labels and uncalibrated probability',()=>{assert.throws(()=>runP4WinCalibrationExperiment({contract,observations:[{...rows[0],closedAt:601},...rows.slice(1)]}));assert.throws(()=>runP4WinCalibrationExperiment({contract,observations:[{...rows[0],probability:null},...rows.slice(1)]}))});
test('few samples do not qualify',()=>{const r=runP4WinCalibrationExperiment({contract,observations:rows.slice(0,35)});assert.equal(r.status,'INSUFFICIENT_CAUSAL_EVIDENCE')});

test('validation outcomes never change fitted calibration parameters',()=>{
 const first=runP4WinCalibrationExperiment({contract,observations:rows});
 const flipped=rows.map(r=>r.decidedAt>=contract.validation.from?{...r,outcome:1-r.outcome}:r);
 const second=runP4WinCalibrationExperiment({contract,observations:flipped});
 assert.deepEqual(first.bins,second.bins);
 assert.equal(first.trainingPrior,second.trainingPrior);
 assert.equal(first.trainFingerprint,second.trainFingerprint);
 assert.notEqual(first.validationFingerprint,second.validationFingerprint);
 assert.equal(first.championPromotionAllowed,false);
});
