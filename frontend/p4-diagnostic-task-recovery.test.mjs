import test from 'node:test';
import assert from 'node:assert/strict';
import {createP4DiagnosticTaskRecord,transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
import {recoverP4DiagnosticTask} from './p4-diagnostic-task-recovery.mjs';
const plan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'research_1',status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
const initial=()=>createP4DiagnosticTaskRecord(plan,{taskId:'task_1',createdAtMs:1});
test('stale RUNNING task is marked FAILED then safely requeued without replay',async()=>{
 let record=transitionP4DiagnosticTask(transitionP4DiagnosticTask(initial(),{to:'READY',atMs:2}),{to:'RUNNING',atMs:3,executionJobId:'run_1'});
 const writes=[];
 const store={load:async()=>record,transition:async(old,next)=>{assert.deepEqual(old,record);writes.push(next.status);record=next;}};
 assert.equal((await recoverP4DiagnosticTask({store,taskId:'task_1',atMs:500})).status,'ACTIVE_NOT_RECOVERED');
 assert.equal(writes.length,0);
 assert.equal((await recoverP4DiagnosticTask({store,taskId:'task_1',atMs:3600004})).status,'STALE_MARKED_FAILED');
 assert.equal((await recoverP4DiagnosticTask({store,taskId:'task_1',atMs:3600005})).status,'REQUEUED');
 assert.deepEqual(writes,['FAILED','READY']);
 assert.equal(record.attempt,1);
 assert.equal(record.ordersEnabled,false);
});
test('completed task cannot be restarted',async()=>{
 let r=transitionP4DiagnosticTask(initial(),{to:'READY',atMs:2});
 r=transitionP4DiagnosticTask(r,{to:'RUNNING',atMs:3,executionJobId:'run_1'});
 r=transitionP4DiagnosticTask(r,{to:'COMPLETED',atMs:4,resultJobId:'result_1'});
 const store={load:async()=>r,transition:async()=>{throw Error('must not write')}};
 assert.equal((await recoverP4DiagnosticTask({store,taskId:'task_1',atMs:3600005})).status,'UNCHANGED');
});
