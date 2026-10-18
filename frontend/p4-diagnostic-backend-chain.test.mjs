import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4DiagnosticBackendChain} from './p4-diagnostic-backend-chain.mjs';
const hour=3600000;
const w=(start)=>({symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:start*hour,toOpenTime:(start+199)*hour,asOfMs:(start+201)*hour});
test('overlapping historical research evidence rejected before any writes',async()=>{
 let writes=0;
 await assert.rejects(()=>runP4DiagnosticBackendChain({grant:{maxRounds:2},windows:[w(1000),w(1100)],taskStore:{create:async()=>{writes++}},summaryStore:{load:async()=>null}}),/overlapping historical/);
 assert.equal(writes,0);
});
test('disjoint but invalid candle evidence rejected before any writes',async()=>{
 await assert.rejects(()=>runP4DiagnosticBackendChain({grant:{maxRounds:1},windows:[{...w(1000),asOfMs:1199*hour}]}),/invalid historical evidence/);
});

import {createP4DiagnosticTaskRecord} from './p4-diagnostic-task-lifecycle.mjs';
test('backend chain runs two distinct historical windows and passes prior diagnosis into next experiment',async()=>{
 const plan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'seed',actor:'COLLECT_ENTRY_CAUSAL_EVIDENCE',action:'COLLECT_MORE_TRAIN_EVIDENCE',reason:'NO_ELIGIBLE_TRAIN_CHALLENGER',hypothesis:null,requiresFreshNonOverlappingEvidence:false,status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
 const records=new Map([['t0',createP4DiagnosticTaskRecord(plan,{taskId:'t0',createdAtMs:1})]]);
 const taskStore={load:async id=>records.get(id),transition:async(old,next)=>{assert.equal(records.get(old.taskId),old);records.set(old.taskId,next)},create:async record=>{records.set(record.taskId,record)}};
 const summaries=new Map(),requests=[];
 const summaryStore={load:async id=>summaries.get(id)};
 const result=await runP4DiagnosticBackendChain({taskStore,summaryStore,initialTaskId:'t0',confirm:'RESEARCH_ONLY',atMs:Date.now()+1000,grant:{mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false,maxRounds:2,autoContinueProposals:true,expiresAtMs:9999999999999,allowedTaskIds:['t0']},windows:[w(1000),w(1300)],createExecutionJobId:async({round})=>'backend_job_'+round,createTaskId:async({sourceJobId})=>'next_'+sourceJobId,runPersisted:async args=>{
 requests.push(args);
 const summary={schemaVersion:'P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1',jobId:args.researchJobId,taskId:args.task.id,status:'NO_TRAIN_SELECTED_ARM',loadedCandles:200,trainingResults:[],selectedArm:null,oosEvidenceStatus:'NOT_EVALUATED',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 summaries.set(args.researchJobId,summary);
 return {status:'COMMITTED',summary};
 }});
 assert.equal(result.status,'STOPPED_MAX_ROUNDS');
 assert.equal(requests.length,2);
 assert.equal(requests[0].fromOpenTime,1000*hour);
 assert.equal(requests[1].fromOpenTime,1300*hour);
 assert.equal(requests[1].task.sourceJobId,'backend_job_1');
});

test('future evidence cutoff is rejected before opening persistent stores',async()=>{
 const future=w(1000);
 future.asOfMs=Date.now()+86400000;
 await assert.rejects(()=>runP4DiagnosticBackendChain({grant:{maxRounds:1},windows:[future]}),/future historical cutoff/);
});
