import test from 'node:test';
import assert from 'node:assert/strict';
import {replayP4DiagnosticArm} from './p4-diagnostic-arm-replay.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
test('rejects mismatched diagnostic arm before touching historical replay',async()=>{
 await assert.rejects(()=>replayP4DiagnosticArm({taskId:'COLLECT_ENTRY_CAUSAL_EVIDENCE',arm:{parameter:'entryLookback',direction:1,from:20,to:22,parameters:{...DEFAULT_TRAINING_PARAMETERS,entryLookback:21}}}),/parameter mismatch/);
});
test('rejects unchanged or malformed diagnostic candidate',async()=>{
 await assert.rejects(()=>replayP4DiagnosticArm({taskId:'x',arm:{parameter:'entryLookback',direction:1,from:20,to:20,parameters:DEFAULT_TRAINING_PARAMETERS}}),/invalid diagnostic experiment arm/);
});

test('rejects opposite mutation direction before replay',async()=>{
 await assert.rejects(()=>replayP4DiagnosticArm({taskId:'x',arm:{parameter:'entryLookback',direction:-1,from:20,to:21,parameters:{...DEFAULT_TRAINING_PARAMETERS,entryLookback:21}}}),/parameter mismatch/);
});
