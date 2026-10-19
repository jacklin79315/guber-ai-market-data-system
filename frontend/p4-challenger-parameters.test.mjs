import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_TRAINING_PARAMETERS as defaults,validateTrainingParameters,generateChallengerParameters as generate} from './p4-challenger-parameters.mjs';
test('defaults match bounded research parameter contract',()=>assert.deepEqual(validateTrainingParameters(defaults),defaults));
test('same seed and iteration yield identical challenger',()=>assert.deepEqual(generate({parent:defaults,seed:42,iteration:3}),generate({parent:defaults,seed:42,iteration:3})));
test('each mutation changes exactly one parameter and stays in bounds',()=>{for(let i=0;i<200;i++){const c=generate({parent:defaults,seed:42,iteration:i});const changed=Object.keys(defaults).filter(k=>c.parameters[k]!==defaults[k]);assert.equal(changed.length,1);assert.equal(changed[0],c.mutatedParameter);validateTrainingParameters(c.parameters)}});
test('invalid ranges are rejected',()=>{assert.throws(()=>validateTrainingParameters({...defaults,rewardStopAtr:50}),/invalid parameter/);assert.throws(()=>validateTrainingParameters({...defaults,entryLookback:1.5}),/invalid parameter/)});
test('invalid seed and unknown parameters are rejected',()=>{assert.throws(()=>generate({parent:defaults,seed:-1}),/seed/);assert.throws(()=>validateTrainingParameters({...defaults,unknown:1}),/shape/)});
test('mutation never modifies parent parameters',()=>{const p={...defaults};generate({parent:p,seed:4});assert.deepEqual(p,defaults)});

test('attributed expert focus explores only its owned parameter family',()=>{
 for(const actor of ['Entry','Reward'])for(let i=0;i<50;i++){
  const result=generate({parent:defaults,seed:19,iteration:i,preferredActor:actor});
  assert.ok(result.mutatedParameter.startsWith(actor.toLowerCase()));
  assert.equal(Object.keys(defaults).filter(k=>result.parameters[k]!==defaults[k]).length,1);
 }
});

test('directed research probe moves the selected parameter exactly one bounded tick',()=>{
 const r=generate({parent:defaults,seed:7,iteration:2,directedProbe:{parameter:'entryLookback',direction:1}});
 assert.equal(r.mutatedParameter,'entryLookback');
 assert.equal(r.from,20);assert.equal(r.to,21);
 assert.equal(r.probeSource,'PRIOR_SAME_WINDOW_RESULT');
 assert.deepEqual(Object.keys(r.parameters).filter(k=>r.parameters[k]!==defaults[k]),['entryLookback']);
});

test('visited candidates are not replayed when a fresh one-tick neighbor exists',()=>{const first=generate({parent:defaults,seed:7,iteration:0});const second=generate({parent:defaults,seed:7,iteration:0,visitedParameterSets:[first.parameters]});assert.notDeepEqual(second.parameters,first.parameters);assert.equal(Object.keys(defaults).filter(k=>second.parameters[k]!==defaults[k]).length,1)});
test('directed probe falls back to an unseen neighbor instead of repeating a failed candidate',()=>{const prior=generate({parent:defaults,seed:7,iteration:0,directedProbe:{parameter:'rewardStopAtr',direction:1}});const next=generate({parent:defaults,seed:7,iteration:1,directedProbe:{parameter:'rewardStopAtr',direction:1},visitedParameterSets:[prior.parameters]});assert.notDeepEqual(next.parameters,prior.parameters)});

test('expands search radius rather than cycling after every one-tick neighbor is visited',()=>{const visited=[];for(const key of Object.keys(defaults)){const step=key==='entryThreshold'?0.0001:key==='rewardStopAtr'||key==='rewardTakeAtr'?0.1:1;for(const direction of [-1,1]){const p={...defaults,[key]:Number((defaults[key]+step*direction).toFixed(8))};try{validateTrainingParameters(p);visited.push(p)}catch{}}}const candidate=generate({parent:defaults,seed:7,iteration:0,visitedParameterSets:visited});assert.equal(candidate.probeSource,'UNSEEN_RADIUS_EXPANSION');assert.equal(Object.keys(defaults).filter(k=>candidate.parameters[k]!==defaults[k]).length,1);assert.ok(!visited.some(p=>JSON.stringify(p)===JSON.stringify(candidate.parameters)))});
