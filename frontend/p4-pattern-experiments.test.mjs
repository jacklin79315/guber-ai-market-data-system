import test from 'node:test';import assert from 'node:assert/strict';
import {planP4PatternExperiments} from './p4-pattern-experiments.mjs';
import {DEFAULT_TRAINING_PARAMETERS as p} from './p4-challenger-parameters.mjs';
const pattern=(actor,status='HYPOTHESIS_FOR_CAUSAL_REVIEW')=>({schemaVersion:'P4_DIAGNOSTIC_PATTERN_V1',evidenceId:'evidence-1',actor,status,supportingEvents:30});
const report=(patterns)=>({schemaVersion:'P4_DIAGNOSTIC_PATTERN_REPORT_V1',auditFingerprint:'a'.repeat(64),patterns});
test('entry fault generates both signs for both entry controls without choosing a winner',()=>{
 const x=planP4PatternExperiments({report:report([pattern('Entry')]),parentParameters:p});
 assert.equal(x.experiments.length,4);assert.deepEqual(x.experiments.filter(e=>e.parameter==='entryLookback').map(e=>e.parameters.entryLookback),[19,21]);
 assert(x.experiments.every(e=>e.causalEffectVerified===false&&e.promotionAllowed===false));assert.deepEqual(p.entryLookback,20);
});
test('risk faults without trainable controls are explicitly unsupported',()=>{
 const x=planP4PatternExperiments({report:report([pattern('Risk')]),parentParameters:p});
 assert.equal(x.experiments.length,0);assert.equal(x.unsupported[0].reason,'NO_TRAINABLE_CONTROL_FOR_ACTOR');
});
test('insufficient evidence does not trigger experiments',()=>{
 const x=planP4PatternExperiments({report:report([pattern('Entry','INSUFFICIENT_PATTERN_SAMPLES')]),parentParameters:p});
 assert.equal(x.experiments.length,0);
});
test('bounded experiments skip directions outside parameter limits',()=>{
 const x=planP4PatternExperiments({report:report([pattern('Entry')]),parentParameters:{...p,entryLookback:5}});
 assert.equal(x.experiments.filter(e=>e.parameter==='entryLookback').length,1);
});
