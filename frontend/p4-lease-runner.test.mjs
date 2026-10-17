import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4WithLease} from './p4-lease-runner.mjs';
const owner='x'.repeat(32);
test('P4 concurrent worker is denied and first worker releases',async()=>{let active=false;const store={claim:async()=>{if(active)return false;active=true;return true},renew:async()=>active,release:async()=>{active=false;return true}};let release;const gate=new Promise(r=>release=r);const first=runP4WithLease({leaseStore:store,jobId:'job',ownerToken:owner,run:async({ensureLease})=>{await ensureLease();await gate;return 'done'}});await assert.rejects(runP4WithLease({leaseStore:store,jobId:'job',ownerToken:'y'.repeat(32),run:async()=>{throw Error('must not run')}}),/already leased/);release();assert.equal(await first,'done');assert.equal(active,false)});
test('P4 lease lost fails closed before next commit',async()=>{let released=false;const store={claim:async()=>true,renew:async()=>false,release:async()=>{released=true;return true}};await assert.rejects(runP4WithLease({leaseStore:store,jobId:'job',ownerToken:owner,run:async({ensureLease})=>ensureLease()}),/lease lost/);assert.equal(released,true)});
