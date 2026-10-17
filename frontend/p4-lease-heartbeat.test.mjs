import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4WithLease} from './p4-lease-runner.mjs';
const owner='x'.repeat(32);
test('P4 lease heartbeat renews while research is busy',async()=>{let renews=0,released=false;const store={claim:async()=>true,renew:async()=>{renews++;return true},release:async()=>{released=true;return true}};const result=await runP4WithLease({leaseStore:store,jobId:'heartbeat',ownerToken:owner,leaseSeconds:30,heartbeatMs:1000,run:async()=>{await new Promise(r=>setTimeout(r,1150));return 'done'}});assert.equal(result,'done');assert.ok(renews>=1);assert.equal(released,true)});
test('P4 heartbeat loss fails closed after running work completes',async()=>{let renews=0;const store={claim:async()=>true,renew:async()=>{renews++;return false},release:async()=>true};await assert.rejects(runP4WithLease({leaseStore:store,jobId:'heartbeat-loss',ownerToken:owner,leaseSeconds:30,heartbeatMs:1000,run:async()=>{await new Promise(r=>setTimeout(r,1150));return 'must not succeed'}}),/lease lost/);assert.ok(renews>=1)});
