import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareP4PersistedFollowUp} from './p4-diagnostic-follow-up-source.mjs';
const hypothesis={parameter:'entryLookback',failedFrom:20,failedTo:21,avoidDirection:1,evidence:'PRIOR_OOS_NOT_IMPROVED'};
const plan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'source',actor:'COLLECT_ENTRY_CAUSAL_EVIDENCE',action:'REVISE_HYPOTHESIS',reason:'SELECTED_CHALLENGER_DID_NOT_IMPROVE_OOS',hypothesis,status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
const summary={jobId:'source',status:'OOS_RESEARCH_EVALUATED',oosEvidenceStatus:'OOS_NOT_IMPROVED',learningEvidence:{assessment:'NO_OOS_IMPROVEMENT',oosSufficient:true},followUpPlan:plan,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
test('persisted negative OOS evidence creates a READY task without execution',async()=>{
 let record=null;let creates=0;
 const taskStore={load:async()=>record,create:async r=>{creates++;record=r},transition:async(a,b)=>{assert.equal(record,a);record=b}};
 const args={confirm:'RESEARCH_ONLY',sourceJobId:'source',taskId:'follow_1',atMs:100,summaryStore:{load:async()=>summary},taskStore};
 const first=await prepareP4PersistedFollowUp(args);
 assert.equal(first.status,'READY');assert.equal(record.plan.hypothesis.avoidDirection,1);assert.equal(record.ordersEnabled,false);
 const again=await prepareP4PersistedFollowUp(args);
 assert.equal(again.status,'READY');assert.equal(creates,1);
});
test('missing OOS sufficiency or invalid confirmation cannot create task',async()=>{
 const taskStore={load:async()=>null,create:async()=>{throw Error('should not create')}};
 const args={confirm:'RESEARCH_ONLY',sourceJobId:'source',taskId:'follow_2',atMs:100,taskStore};
 await assert.rejects(()=>prepareP4PersistedFollowUp({...args,confirm:'LIVE',summaryStore:{load:async()=>summary}}),/confirmation/);
 await assert.rejects(()=>prepareP4PersistedFollowUp({...args,summaryStore:{load:async()=>({...summary,learningEvidence:{assessment:'INSUFFICIENT_OOS_EVIDENCE',oosSufficient:false}})}}),/sufficient negative OOS/);
});
