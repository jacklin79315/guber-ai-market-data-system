import test from 'node:test';
import assert from 'node:assert/strict';
import {createP4DiagnosticTaskStore} from './p4-supabase-diagnostic-tasks.mjs';
import {transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
const record={schemaVersion:'P4_DIAGNOSTIC_TASK_RECORD_V1',taskId:'task_1',sourceJobId:'research_1',status:'PROPOSED',attempt:0,createdAtMs:1,updatedAtMs:1,executionJobId:null,resultJobId:null,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
test('task store rejects unsafe creation before contacting Supabase',async()=>{
 const store=createP4DiagnosticTaskStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'secret',fetchImpl:async()=>{throw Error('unexpected fetch')}});
 await assert.rejects(()=>store.create({...record,ordersEnabled:true}),/unsafe/);
});
test('optimistic task transition rejects concurrent stale updates',async()=>{
 const calls=[];
 const store=createP4DiagnosticTaskStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'secret',fetchImpl:async(u,options)=>{calls.push({url:String(u),method:options.method});return {ok:true,json:async()=>[]};}});
 const ready=transitionP4DiagnosticTask(record,{to:'READY',atMs:2});
 await assert.rejects(()=>store.transition(record,ready),/concurrent transition conflict/);
 assert.equal(calls[0].method,'PATCH');
 assert.ok(new URL(calls[0].url).searchParams.get('record_sha256')?.startsWith('eq.'));
});

test('task store refuses forged lifecycle transitions before fetch',async()=>{
 const store=createP4DiagnosticTaskStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'secret',fetchImpl:async()=>{throw Error('unexpected fetch')}});
 await assert.rejects(()=>store.transition(record,{...record,status:'COMPLETED',updatedAtMs:2,resultJobId:'fake'}),/forbidden/);
});
