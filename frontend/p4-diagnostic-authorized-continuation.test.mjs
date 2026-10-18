import test from 'node:test';
import assert from 'node:assert/strict';
import {continueP4AuthorizedResearch} from './p4-diagnostic-authorized-continuation.mjs';
test('research continuation refuses missing explicit grant',async()=>{
 await assert.rejects(()=>continueP4AuthorizedResearch({confirm:'RESEARCH_ONLY',taskId:'t1',atMs:10}),/authorization/);
});
test('research continuation refuses expired grant before any database access',async()=>{
 let called=false;
 await assert.rejects(()=>continueP4AuthorizedResearch({confirm:'RESEARCH_ONLY',taskId:'t1',atMs:10,grant:{mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false,allowedTaskIds:['t1'],expiresAtMs:10},store:{load:async()=>{called=true}}}),/authorization/);
 assert.equal(called,false);
});

import {createP4DiagnosticTaskRecord} from './p4-diagnostic-task-lifecycle.mjs';
test('independent evidence request stays PROPOSED and does not consume execution authorization',async()=>{
 const plan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'source',actor:'COLLECT_ENTRY_CAUSAL_EVIDENCE',action:'REQUEST_INDEPENDENT_VALIDATION',status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
 const record=createP4DiagnosticTaskRecord(plan,{taskId:'t1',createdAtMs:1});
 let transitions=0;
 const result=await continueP4AuthorizedResearch({store:{load:async()=>record,transition:async()=>{transitions++}},taskId:'t1',executionJobId:'job1',atMs:10,confirm:'RESEARCH_ONLY',grant:{mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false,allowedTaskIds:['t1'],expiresAtMs:100}});
 assert.equal(result.status,'EVIDENCE_COLLECTION_REQUIRED');
 assert.equal(transitions,0);
});
