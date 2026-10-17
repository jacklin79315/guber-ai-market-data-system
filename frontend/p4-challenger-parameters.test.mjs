import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_TRAINING_PARAMETERS as defaults,validateTrainingParameters,generateChallengerParameters as generate} from './p4-challenger-parameters.mjs';
test('defaults match bounded research parameter contract',()=>assert.deepEqual(validateTrainingParameters(defaults),defaults));
test('same seed and iteration yield identical challenger',()=>assert.deepEqual(generate({parent:defaults,seed:42,iteration:3}),generate({parent:defaults,seed:42,iteration:3})));
test('each mutation changes exactly one parameter and stays in bounds',()=>{for(let i=0;i<200;i++){const c=generate({parent:defaults,seed:42,iteration:i});const changed=Object.keys(defaults).filter(k=>c.parameters[k]!==defaults[k]);assert.equal(changed.length,1);assert.equal(changed[0],c.mutatedParameter);validateTrainingParameters(c.parameters)}});
test('invalid ranges are rejected',()=>{assert.throws(()=>validateTrainingParameters({...defaults,rewardStopAtr:50}),/invalid parameter/);assert.throws(()=>validateTrainingParameters({...defaults,entryLookback:1.5}),/invalid parameter/)});
test('invalid seed and unknown parameters are rejected',()=>{assert.throws(()=>generate({parent:defaults,seed:-1}),/seed/);assert.throws(()=>validateTrainingParameters({...defaults,unknown:1}),/shape/)});
test('mutation never modifies parent parameters',()=>{const p={...defaults};generate({parent:p,seed:4});assert.deepEqual(p,defaults)});
