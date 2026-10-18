import test from 'node:test';
import assert from 'node:assert/strict';
import {createP4SupabaseLeaseStore} from './p4-supabase-leases.mjs';
const makeStore=fetchImpl=>createP4SupabaseLeaseStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl});
test('release retries transient 521 then succeeds',async()=>{
 let calls=0;
 const store=makeStore(async()=>{calls++;return calls===1?{ok:false,status:521}:{ok:true,json:async()=>true}});
 assert.equal(await store.release('job','owner'),true);
 assert.equal(calls,2);
});
test('claim never retries after ambiguous server failure',async()=>{
 let calls=0;
 const store=makeStore(async()=>{calls++;return {ok:false,status:521}});
 await assert.rejects(store.claim('job','owner'),/521/);
 assert.equal(calls,1);
});
test('release rejects non-retryable 403 immediately',async()=>{
 let calls=0;
 const store=makeStore(async()=>{calls++;return {ok:false,status:403}});
 await assert.rejects(store.release('job','owner'),/403/);
 assert.equal(calls,1);
});
