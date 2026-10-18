import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4DiagnosticFollowUpBackend} from './p4-diagnostic-follow-up-backend.mjs';
import {createP4DiagnosticTaskRecord,transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
const plan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'original',actor:'COLLECT_ENTRY_CAUSAL_EVIDENCE',action:'REVISE_HYPOTHESIS',reason:'OOS_NOT_IMPROVED',status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
test('historical backend passes diagnostic hypothesis into persisted research and completes only after commit',async()=>{
 let record=transitionP4DiagnosticTask(createP4DiagnosticTaskRecord(plan,{taskId:'follow_1',createdAtMs:1}),{to:'READY',atMs:2});
 const store={load:async()=>record,transition:async(before,after)=>{assert.equal(record,before);record=after}};
 let calls=0;
 const result=await runP4DiagnosticFollowUpBackend({store,taskId:'follow_1',executionJobId:'next_job',atMs:3,confirm:'RESEARCH_ONLY',fromOpenTime:0,toOpenTime:140*3600000,asOfMs:142*3600000,runPersisted:async options=>{calls++;assert.equal(options.task.actor,'Entry');assert.equal(options.researchJobId,'next_job');assert.equal(options.confirm,'RESEARCH_ONLY');return {status:'COMMITTED',summary:{jobId:'next_job',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false}}}});
 assert.equal(calls,1);assert.equal(result.status,'COMPLETED');assert.equal(record.resultJobId,'next_job');
});
test('backend refuses live confirmation and unsupported symbols',async()=>{
 await assert.rejects(()=>runP4DiagnosticFollowUpBackend({confirm:'LIVE'}),/confirmation/);
 await assert.rejects(()=>runP4DiagnosticFollowUpBackend({confirm:'RESEARCH_ONLY',symbol:'DOGEUSDT',fromOpenTime:0,toOpenTime:1,asOfMs:2}),/invalid bounded/);
});

test('follow-up historical replay rejects oversized, unaligned and future-leaking windows',async()=>{
 const base={confirm:'RESEARCH_ONLY',fromOpenTime:0,toOpenTime:1999*3600000,asOfMs:2001*3600000};
 const fail=options=>assert.rejects(()=>runP4DiagnosticFollowUpBackend({...base,...options}),/invalid bounded/);
 await fail({toOpenTime:2000*3600000,asOfMs:2002*3600000});
 await fail({fromOpenTime:1});
 await fail({toOpenTime:129*3600000-1});
 await fail({asOfMs:1999*3600000+3600000-1});
});
