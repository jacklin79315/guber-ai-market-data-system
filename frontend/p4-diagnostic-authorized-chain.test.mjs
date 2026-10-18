import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4AuthorizedDiagnosticChain} from './p4-diagnostic-authorized-chain.mjs';
test('rejects unbounded or unsafe autonomous research grants',async()=>{
 await assert.rejects(()=>runP4AuthorizedDiagnosticChain({confirm:'RESEARCH_ONLY',initialTaskId:'t1',atMs:1,grant:{mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false,maxRounds:101,autoContinueProposals:true,expiresAtMs:1000,allowedTaskIds:['t1']},createExecutionJobId:async()=> 'j1'}),/invalid bounded/);
});
test('rejects task outside initial authorization scope',async()=>{
 await assert.rejects(()=>runP4AuthorizedDiagnosticChain({confirm:'RESEARCH_ONLY',initialTaskId:'t1',atMs:1,grant:{mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false,maxRounds:2,autoContinueProposals:true,expiresAtMs:1000,allowedTaskIds:['other']},createExecutionJobId:async()=> 'j1'}),/initial task/);
});

import {createP4DiagnosticTaskRecord} from './p4-diagnostic-task-lifecycle.mjs';
test('two consecutive research rounds derive next task from prior committed outcome',async()=>{
 const initialPlan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'seed',actor:'COLLECT_ENTRY_CAUSAL_EVIDENCE',action:'REVISE_HYPOTHESIS',reason:'RESEARCH',status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
 const records=new Map([['t0',createP4DiagnosticTaskRecord(initialPlan,{taskId:'t0',createdAtMs:1})]]);
 const store={load:async id=>records.get(id),transition:async(prev,next)=>{assert.equal(records.get(prev.taskId),prev);records.set(prev.taskId,next)}};
 const summaries=[];
 const result=await runP4AuthorizedDiagnosticChain({store,initialTaskId:'t0',confirm:'RESEARCH_ONLY',atMs:Date.now()+1000,grant:{mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false,maxRounds:2,autoContinueProposals:true,expiresAtMs:9999999999999,allowedTaskIds:['t0']},createExecutionJobId:async({round})=>'job_'+round,createTaskId:async({sourceJobId})=>'next_'+sourceJobId,recordNextTask:async record=>{records.set(record.taskId,record)},runResearch:async({executionJobId,sourceJobId})=>{
  summaries.push({executionJobId,sourceJobId});
  return {status:'COMMITTED',summary:{schemaVersion:'P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1',jobId:executionJobId,status:'NO_TRAIN_SELECTED_ARM',loadedCandles:500,trainingResults:[],selectedArm:null,oosEvidenceStatus:'NOT_EVALUATED',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false}};
 }});
 assert.equal(result.status,'STOPPED_MAX_ROUNDS');
 assert.equal(result.rounds.length,2);
 assert.equal(summaries[0].sourceJobId,'seed');
 assert.equal(summaries[1].sourceJobId,'job_1');
 assert.equal(records.get('next_job_1').status,'COMPLETED');
 assert.equal(records.get('next_job_2').status,'PROPOSED');
});
