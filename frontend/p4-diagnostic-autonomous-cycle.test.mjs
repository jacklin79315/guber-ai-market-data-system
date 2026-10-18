import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4DiagnosticAutonomousCycle} from './p4-diagnostic-autonomous-cycle.mjs';
import {createP4DiagnosticTaskRecord,transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
const plan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'source_1',actor:'COLLECT_ENTRY_CAUSAL_EVIDENCE',action:'REVISE_HYPOTHESIS',reason:'OOS_NOT_IMPROVED',status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
test('completed persisted research proposes next hypothesis without executing it',async()=>{
 let record=createP4DiagnosticTaskRecord(plan,{taskId:'task_1',createdAtMs:1});
 record=transitionP4DiagnosticTask(record,{to:'READY',atMs:2});
 let next=null;
 const summary={schemaVersion:'P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1',jobId:'job_1',loadedCandles:500,status:'NO_TRAIN_SELECTED_ARM',trainingResults:[],selectedArm:null,oosEvidenceStatus:'NOT_EVALUATED',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,learningEvidence:{assessment:'NO_TRAIN_SELECTED_ARM'}};
 const result=await runP4DiagnosticAutonomousCycle({store:{load:async()=>record,transition:async(prev,value)=>{assert.equal(prev,record);record=value}},taskId:'task_1',executionJobId:'job_1',atMs:3,confirm:'RESEARCH_ONLY',runResearch:async()=>({status:'COMMITTED',summary}),createTaskId:async()=> 'task_2',recordNextTask:async r=>{next=r}});
 assert.equal(result.status,'COMPLETED_NEXT_RESEARCH_PROPOSED');
 assert.equal(record.status,'COMPLETED');
 assert.equal(next.status,'PROPOSED');
 assert.equal(next.plan.sourceJobId,'job_1');
 assert.equal(next.plan.autoExecutionAuthorized,false);
 assert.equal(result.modelUpdateApplied,false);
});
test('cycle refuses non research execution',async()=>{
 await assert.rejects(()=>runP4DiagnosticAutonomousCycle({confirm:'LIVE'}),/research-only/);
});

test('completed task does not replay experiment after worker restart',async()=>{
 const record={status:'COMPLETED',resultJobId:'job_1'};
 const result=await runP4DiagnosticAutonomousCycle({confirm:'RESEARCH_ONLY',store:{load:async()=>record},taskId:'task_1',executionJobId:'job_1',createTaskId:async()=>{throw Error('should not create')},recordNextTask:async()=>{throw Error('should not write')},runResearch:async()=>{throw Error('must not replay')}});
 assert.equal(result.status,'ALREADY_COMPLETED_REQUIRES_RECOVERY');
 assert.equal(result.completedJobId,'job_1');
});

test('restart recovers next action from committed summary without replay',async()=>{
 const summary={schemaVersion:'P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1',jobId:'job_1',loadedCandles:500,status:'NO_TRAIN_SELECTED_ARM',trainingResults:[],selectedArm:null,oosEvidenceStatus:'NOT_EVALUATED',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 const result=await runP4DiagnosticAutonomousCycle({confirm:'RESEARCH_ONLY',store:{load:async()=>({status:'COMPLETED',resultJobId:'job_1'})},taskId:'task_1',executionJobId:'job_1',createTaskId:async()=>{throw Error('must not create')},recordNextTask:async()=>{throw Error('must not write')},runResearch:async()=>{throw Error('must not replay')},loadCommittedSummary:async id=>{assert.equal(id,'job_1');return summary}});
 assert.equal(result.status,'COMPLETED_RECOVERED_NEXT_ACTION');
 assert.equal(result.nextAction,'COLLECT_MORE_TRAIN_EVIDENCE');
 assert.equal(result.nextPlan.autoExecutionAuthorized,false);
});
