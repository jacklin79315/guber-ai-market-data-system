import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4DiagnosticResearchBatch} from './p4-diagnostic-research-batch.mjs';
test('batch rejects tasks without READY authorization before research',async()=>{
 let runs=0;
 await assert.rejects(()=>runP4DiagnosticResearchBatch({confirm:'RESEARCH_ONLY',store:{load:async()=>({status:'PROPOSED'})},authorizedTasks:[{taskId:'t1',executionJobId:'j1',atMs:5}],runResearch:async()=>{runs++},createTaskId:async()=> 'next',recordNextTask:async()=>{}}),/not explicitly READY/);
 assert.equal(runs,0);
});
test('batch rejects duplicate research job IDs',async()=>{
 await assert.rejects(()=>runP4DiagnosticResearchBatch({confirm:'RESEARCH_ONLY',store:{load:async()=>({status:'READY'})},authorizedTasks:[{taskId:'t1',executionJobId:'j1',atMs:5},{taskId:'t2',executionJobId:'j1',atMs:6}]}),/duplicate/);
});
