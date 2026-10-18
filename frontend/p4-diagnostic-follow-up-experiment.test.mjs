import test from 'node:test';
import assert from 'node:assert/strict';
import {mapP4FollowUpToExperimentTask,runP4FollowUpExperiment} from './p4-diagnostic-follow-up-experiment.mjs';
const plan={schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:'research_1',action:'REVISE_HYPOTHESIS',reason:'OOS_NOT_IMPROVED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
test('negative OOS evidence maps to a bounded existing Entry experiment task',()=>{
 const result=mapP4FollowUpToExperimentTask(plan);
 assert.equal(result.status,'EXPERIMENT_READY');
 assert.equal(result.task.id,'COLLECT_ENTRY_CAUSAL_EVIDENCE');
 assert.equal(result.task.sourceJobId,'research_1');
});
test('independent validation request does not mutate parameters',()=>{
 const result=mapP4FollowUpToExperimentTask({...plan,action:'REQUEST_INDEPENDENT_VALIDATION'});
 assert.equal(result.status,'EVIDENCE_COLLECTION_REQUIRED');
 assert.equal(result.task,null);
});
test('research execution requires explicit consent and forbids unsafe plans',async()=>{
 await assert.rejects(()=>runP4FollowUpExperiment({plan}),/confirmation/);
 assert.throws(()=>mapP4FollowUpToExperimentTask({...plan,ordersEnabled:true}),/unsafe/);
});
