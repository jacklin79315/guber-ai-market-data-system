import test from 'node:test';
import assert from 'node:assert/strict';
import {executeP4DiagnosticFollowUp} from './p4-diagnostic-follow-up-execution.mjs';
import {createP4DiagnosticTaskRecord,transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
const plan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'source_1',actor:'COLLECT_ENTRY_CAUSAL_EVIDENCE',action:'REVISE_HYPOTHESIS',reason:'OOS_NOT_IMPROVED',status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
function fixture(){let record=createP4DiagnosticTaskRecord(plan,{taskId:'task_1',createdAtMs:1});record=transitionP4DiagnosticTask(record,{to:'READY',atMs:2});return {store:{load:async()=>record,transition:async(prev,next)=>{assert.equal(record,prev);record=next}},get:()=>record};}
test('explicit research run persists task completion only after committed safe summary',async()=>{
 const f=fixture();
 const out=await executeP4DiagnosticFollowUp({store:f.store,taskId:'task_1',executionJobId:'job_1',atMs:3,confirm:'RESEARCH_ONLY',runResearch:async({task,confirm})=>{assert.equal(task.actor,'Entry');assert.equal(confirm,'RESEARCH_ONLY');return {status:'COMMITTED',summary:{jobId:'job_1',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false}}}});
 assert.equal(out.status,'COMPLETED');assert.equal(f.get().status,'COMPLETED');assert.equal(f.get().attempt,1);
});
test('uncommitted research fails safely and records FAILED',async()=>{
 const f=fixture();
 await assert.rejects(()=>executeP4DiagnosticFollowUp({store:f.store,taskId:'task_1',executionJobId:'job_2',atMs:3,confirm:'RESEARCH_ONLY',runResearch:async()=>({status:'COMMITTED',summary:{jobId:'wrong'}})}),/not durably committed/);
 assert.equal(f.get().status,'FAILED');
});
test('missing explicit confirmation never runs',async()=>{
 const f=fixture();
 await assert.rejects(()=>executeP4DiagnosticFollowUp({store:f.store,taskId:'task_1',executionJobId:'job_3',atMs:3,runResearch:async()=>{throw Error('should not run')}}),/confirmation/);
 assert.equal(f.get().status,'READY');
});
