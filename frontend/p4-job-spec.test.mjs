import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprintP4JobSpec,assertP4CheckpointCompatible} from './p4-job-spec.mjs';
const spec={symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:0,toOpenTime:3600000,codeRevision:'abc',championVersion:'v1',iterations:100,seed:42,parameters:{a:1,b:2}};
test('P4 immutable fingerprint ignores object key ordering',()=>{const same={...spec,parameters:{b:2,a:1}};assert.equal(fingerprintP4JobSpec(spec),fingerprintP4JobSpec(same))});
test('P4 immutable fingerprint changes with symbol and research settings',()=>{assert.notEqual(fingerprintP4JobSpec(spec),fingerprintP4JobSpec({...spec,symbol:'SOLUSDT'}));assert.notEqual(fingerprintP4JobSpec(spec),fingerprintP4JobSpec({...spec,seed:43}))});
test('P4 resume refuses mismatched job identity or spec fingerprint',()=>{const fp=fingerprintP4JobSpec(spec);assert.equal(assertP4CheckpointCompatible({jobId:'job1',specFingerprint:fp},{jobId:'job1',specFingerprint:fp}),true);assert.throws(()=>assertP4CheckpointCompatible({jobId:'job1',specFingerprint:fp},{jobId:'job2',specFingerprint:fp}),/does not match/)});
