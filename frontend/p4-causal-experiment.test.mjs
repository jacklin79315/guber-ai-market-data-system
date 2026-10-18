import test from 'node:test';
import assert from 'node:assert/strict';
import {defineP4CausalExperiment,assessP4CausalExperiment} from './p4-causal-experiment.mjs';
const valid={jobId:'p4_causal_test',kind:'WIN_PROBABILITY_CALIBRATION',hypothesis:'Past-only calibration reduces probability error',train:{from:100,to:200,asOf:210},validation:{from:300,to:400,asOf:410}};
test('chronological disjoint contract stays research only',()=>{const c=defineP4CausalExperiment(valid);assert.equal(c.ordersEnabled,false);assert.equal(c.championPromotionAllowed,false);assert.equal(assessP4CausalExperiment({contract:c,trainSamples:35,validationSamples:35,baselineMetric:.2,candidateMetric:.15}).status,'EVIDENCE_READY_FOR_INDEPENDENT_REVIEW')});
test('reject leakage and overlapping windows',()=>{assert.throws(()=>defineP4CausalExperiment({...valid,train:{from:100,to:310,asOf:320}}));assert.throws(()=>defineP4CausalExperiment({...valid,train:{from:100,to:200,asOf:310}}))});
test('insufficient evidence cannot pass',()=>{const c=defineP4CausalExperiment({...valid,kind:'WAIT_SHADOW_DECISION_QUALITY'});assert.equal(assessP4CausalExperiment({contract:c,trainSamples:50,validationSamples:3,baselineMetric:0,candidateMetric:1}).status,'INSUFFICIENT_CAUSAL_EVIDENCE');assert.throws(()=>assessP4CausalExperiment({contract:{...c,ordersEnabled:true},trainSamples:50,validationSamples:50}))});
