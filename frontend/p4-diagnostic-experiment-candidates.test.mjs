import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
import {proposeP4DiagnosticExperimentArms} from './p4-diagnostic-experiment-candidates.mjs';
test('Entry evidence gap creates bounded bidirectional research arms only',()=>{
 const result=proposeP4DiagnosticExperimentArms({task:{id:'COLLECT_ENTRY_CAUSAL_EVIDENCE',actor:'Entry',priority:'MEDIUM',sampleCount:40},parentParameters:DEFAULT_TRAINING_PARAMETERS});
 assert.equal(result.arms.length,4);
 assert.deepEqual(result.arms.map(a=>[a.parameter,a.direction]),[['entryLookback',-1],['entryLookback',1],['entryThreshold',-1],['entryThreshold',1]]);
 assert.equal(result.modelUpdateApplied,false);
 assert.equal(result.causalEffectProven,false);
 assert.equal(result.ordersEnabled,false);
 assert.deepEqual(DEFAULT_TRAINING_PARAMETERS,{entryLookback:20,entryThreshold:0.001,rewardAtrPeriod:14,rewardStopAtr:1.5,rewardTakeAtr:3});
});
test('non-parameter evidence tasks do not silently mutate models',()=>{
 const result=proposeP4DiagnosticExperimentArms({task:{id:'CALIBRATE_UNKNOWN_WIN_PROBABILITY',actor:'Win',sampleCount:40},parentParameters:DEFAULT_TRAINING_PARAMETERS});
 assert.equal(result.arms.length,0);
 assert.equal(result.status,'NO_PARAMETER_EXPERIMENT_FOR_TASK');
});

test('a forged or mismatched task cannot nominate another expert parameter',()=>{
 const result=proposeP4DiagnosticExperimentArms({task:{id:'COLLECT_REWARD_CAUSAL_EVIDENCE',actor:'Entry',priority:'MEDIUM',sampleCount:40},parentParameters:DEFAULT_TRAINING_PARAMETERS});
 assert.equal(result.arms.length,0);
});

test('prior OOS failure excludes same direction at same baseline but preserves alternatives',()=>{
 const task={id:'COLLECT_ENTRY_CAUSAL_EVIDENCE',actor:'Entry',priority:'MEDIUM',sampleCount:40,avoidPriorFailedDirection:{parameter:'entryLookback',failedFrom:20,failedTo:19,avoidDirection:-1,evidence:'PRIOR_OOS_NOT_IMPROVED'}};
 const result=proposeP4DiagnosticExperimentArms({task,parentParameters:DEFAULT_TRAINING_PARAMETERS});
 assert.equal(result.arms.some(a=>a.parameter==='entryLookback'&&a.direction===-1),false);
 assert.equal(result.arms.some(a=>a.parameter==='entryLookback'&&a.direction===1),true);
});

test('bounded multi-step exploration excludes prior failed direction across all step sizes',()=>{
 const task={id:'COLLECT_ENTRY_CAUSAL_EVIDENCE',actor:'Entry',priority:'MEDIUM',sampleCount:40,avoidPriorFailedDirection:{parameter:'entryLookback',failedFrom:20,failedTo:21,avoidDirection:1,evidence:'PRIOR_OOS_NOT_IMPROVED'}};
 const result=proposeP4DiagnosticExperimentArms({task,parentParameters:DEFAULT_TRAINING_PARAMETERS,maxArms:10,explorationSteps:[1,2,3]});
 assert.equal(result.arms.some(a=>a.parameter==='entryLookback'&&a.direction===1),false);
 assert.equal(result.arms.some(a=>a.parameter==='entryLookback'&&a.to===18),true);
 assert.equal(result.arms.some(a=>a.parameter==='entryThreshold'&&a.to===0.0008),true);
 assert.equal(result.arms.every(a=>a.to!==a.from),true);
});
test('reject excessive or duplicate exploration steps',()=>{
 const task={id:'COLLECT_ENTRY_CAUSAL_EVIDENCE',actor:'Entry',priority:'MEDIUM',sampleCount:40};
 for(const explorationSteps of [[0],[1,1],[1,2,3,4],[1,6],[-1]])assert.throws(()=>proposeP4DiagnosticExperimentArms({task,parentParameters:DEFAULT_TRAINING_PARAMETERS,explorationSteps}),/invalid exploration steps/);
});
