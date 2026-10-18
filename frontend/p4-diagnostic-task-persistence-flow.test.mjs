import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureP4DiagnosticFollowUpTask,resumeP4DiagnosticFollowUpTask} from './p4-diagnostic-task-persistence-flow.mjs';
import {transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
const plan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'research_1',status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
const summary={jobId:'research_1',ordersEnabled:false,championPromotionAllowed:false,modelUpdateApplied:false,followUpPlan:plan};
test('durable research task creates once and verifies readback',async()=>{
 const records=new Map();let writes=0;
 const store={load:async id=>records.get(id)??null,create:async r=>{writes++;records.set(r.taskId,r)},transition:async(old,next)=>{records.set(old.taskId,next)}};
 const args={store,summary,taskId:'task_1',createdAtMs:1};
 assert.equal((await ensureP4DiagnosticFollowUpTask(args)).status,'CREATED');
 assert.equal((await ensureP4DiagnosticFollowUpTask(args)).status,'ALREADY_EXISTS');
 assert.equal(writes,1);
 let r=records.get('task_1');
 r=transitionP4DiagnosticTask(r,{to:'READY',atMs:2});records.set('task_1',r);
 r=transitionP4DiagnosticTask(r,{to:'RUNNING',atMs:3,executionJobId:'run_1'});records.set('task_1',r);
 assert.equal((await resumeP4DiagnosticFollowUpTask({store,taskId:'task_1',atMs:3600004})).status,'STALE_MARKED_FAILED');
 assert.equal((await resumeP4DiagnosticFollowUpTask({store,taskId:'task_1',atMs:3600005})).status,'REQUEUED');
 assert.equal(records.get('task_1').attempt,1);
});
test('rejects a mismatched source job and unsafe follow-up',async()=>{
 const store={load:async()=>null,create:async()=>{throw Error('must not create')}};
 await assert.rejects(()=>ensureP4DiagnosticFollowUpTask({store,summary:{...summary,jobId:'other'},taskId:'task_1',createdAtMs:1}),/unsafe/);
});

test('readback accepts semantically identical JSONB with reordered keys',async()=>{
 const reverseKeys=value=>Array.isArray(value)?value.map(reverseKeys):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reverseKeys(v)])):value;
 let stored=null;
 const store={load:async()=>stored,create:async record=>{stored=reverseKeys(record)}};
 const outcome=await ensureP4DiagnosticFollowUpTask({store,summary,taskId:'jsonb_order_1',createdAtMs:10});
 assert.equal(outcome.status,'CREATED');
 assert.equal((await ensureP4DiagnosticFollowUpTask({store,summary,taskId:'jsonb_order_1',createdAtMs:10})).status,'ALREADY_EXISTS');
});
