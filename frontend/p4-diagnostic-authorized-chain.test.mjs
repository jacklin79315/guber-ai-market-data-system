import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4AuthorizedDiagnosticChain} from './p4-diagnostic-authorized-chain.mjs';
test('rejects unbounded or unsafe autonomous research grants',async()=>{
 await assert.rejects(()=>runP4AuthorizedDiagnosticChain({confirm:'RESEARCH_ONLY',initialTaskId:'t1',atMs:1,grant:{mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false,maxRounds:101,autoContinueProposals:true,expiresAtMs:1000,allowedTaskIds:['t1']},createExecutionJobId:async()=> 'j1'}),/invalid bounded/);
});
test('rejects task outside initial authorization scope',async()=>{
 await assert.rejects(()=>runP4AuthorizedDiagnosticChain({confirm:'RESEARCH_ONLY',initialTaskId:'t1',atMs:1,grant:{mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false,maxRounds:2,autoContinueProposals:true,expiresAtMs:1000,allowedTaskIds:['other']},createExecutionJobId:async()=> 'j1'}),/initial task/);
});
