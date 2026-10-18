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
