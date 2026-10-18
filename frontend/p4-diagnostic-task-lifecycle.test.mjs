import test from 'node:test';
import assert from 'node:assert/strict';
import {createP4DiagnosticTaskRecord,transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
const plan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'round_2000',status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
const create=()=>createP4DiagnosticTaskRecord(plan,{taskId:'task_1',createdAtMs:1});
test('research task follows explicit recoverable lifecycle',()=>{
 let r=create();
 r=transitionP4DiagnosticTask(r,{to:'READY',atMs:2});
 r=transitionP4DiagnosticTask(r,{to:'RUNNING',atMs:3,executionJobId:'run_1'});
 r=transitionP4DiagnosticTask(r,{to:'FAILED',atMs:4});
 r=transitionP4DiagnosticTask(r,{to:'READY',atMs:5});
 r=transitionP4DiagnosticTask(r,{to:'RUNNING',atMs:6,executionJobId:'run_2'});
 r=transitionP4DiagnosticTask(r,{to:'COMPLETED',atMs:7,resultJobId:'result_2'});
 assert.equal(r.attempt,2);
 assert.equal(r.resultJobId,'result_2');
 assert.equal(r.ordersEnabled,false);
 assert.throws(()=>transitionP4DiagnosticTask(r,{to:'READY',atMs:8}),/forbidden/);
});
test('rejects automatic authorization, missing execution IDs and stale transitions',()=>{
 assert.throws(()=>createP4DiagnosticTaskRecord({...plan,autoExecutionAuthorized:true},{taskId:'task_1',createdAtMs:1}),/unsafe/);
 const r=create();
 assert.throws(()=>transitionP4DiagnosticTask(r,{to:'RUNNING',atMs:2,executionJobId:'run_1'}),/forbidden/);
 assert.throws(()=>transitionP4DiagnosticTask(r,{to:'READY',atMs:1}),/invalid/);
 const ready=transitionP4DiagnosticTask(r,{to:'READY',atMs:2});
 assert.throws(()=>transitionP4DiagnosticTask(ready,{to:'RUNNING',atMs:3}),/required/);
});
