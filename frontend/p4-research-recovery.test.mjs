import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
import {restoreP4ResearchRounds} from './p4-research-recovery.mjs';
const p=DEFAULT_TRAINING_PARAMETERS;
test('P4 recovery rejects skipped or reordered rounds before replay',()=>{assert.throws(()=>restoreP4ResearchRounds({championVersion:'v1',championParameters:p,iterations:3,rounds:[{iteration:2}]}),/sequence mismatch/)});
test('P4 recovery rejects more rounds than requested',()=>{assert.throws(()=>restoreP4ResearchRounds({championVersion:'v1',championParameters:p,iterations:1,rounds:[{},{}]}),/invalid P4 recovery/)});
