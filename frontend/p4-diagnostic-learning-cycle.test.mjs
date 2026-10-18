import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
import {summarizeP4DiagnosticResearch} from './p4-diagnostic-research-summary.mjs';
import {mapP4FollowUpToExperimentTask} from './p4-diagnostic-follow-up-experiment.mjs';
import {proposeP4DiagnosticExperimentArms} from './p4-diagnostic-experiment-candidates.mjs';
const fb=(c,h)=>({status:'RESEARCH_EVIDENCE_ONLY',champion:{netRealizedPnl:c},challenger:{netRealizedPnl:h},improvedInSameWindow:h>c});
test('negative OOS -> diagnostic summary -> hypothesis -> alternative experiment arms',()=>{
 const result={status:'OOS_RESEARCH_EVALUATED',loadedCandles:2000,selectedArm:{parameter:'entryLookback',from:20,to:19},trainingBatch:{taskId:'COLLECT_ENTRY_CAUSAL_EVIDENCE',plannedArms:4,completedArms:4,results:[{arm:{parameter:'entryLookback',from:20,to:19},feedback:fb(-80,-39)}]},validationResult:{feedback:fb(5,2)},oosReplayEvaluated:true,oosImprovedInReplay:false};
 const summary=summarizeP4DiagnosticResearch({result,jobId:'research_negative_oos',createdAtMs:1});
 assert.equal(summary.followUpPlan.action,'REVISE_HYPOTHESIS');
 assert.deepEqual(summary.followUpPlan.hypothesis,{parameter:'entryLookback',failedFrom:20,failedTo:19,avoidDirection:-1,evidence:'PRIOR_OOS_NOT_IMPROVED'});
 const route=mapP4FollowUpToExperimentTask(summary.followUpPlan);
 assert.equal(route.status,'EXPERIMENT_READY');
 const batch=proposeP4DiagnosticExperimentArms({task:route.task,parentParameters:DEFAULT_TRAINING_PARAMETERS});
 assert.equal(batch.arms.some(a=>a.parameter==='entryLookback'&&a.to===19),false);
 assert.equal(batch.arms.some(a=>a.parameter==='entryLookback'&&a.to===21),true);
 assert.equal(batch.modelUpdateApplied,false);
 assert.equal(batch.championPromotionAllowed,false);
});
test('insufficient OOS evidence must not generate a revised hypothesis',()=>{
 const result={status:'OOS_RESEARCH_EVALUATED',loadedCandles:2000,selectedArm:{parameter:'entryLookback',from:20,to:19},trainingBatch:{taskId:'COLLECT_ENTRY_CAUSAL_EVIDENCE',results:[]},validationResult:{feedback:{status:'INSUFFICIENT_RESEARCH_SAMPLES'}},oosReplayEvaluated:true,oosImprovedInReplay:false};
 const summary=summarizeP4DiagnosticResearch({result,jobId:'research_insufficient_oos',createdAtMs:2});
 assert.equal(summary.followUpPlan.hypothesis,null);
 assert.equal(mapP4FollowUpToExperimentTask(summary.followUpPlan).status,'EVIDENCE_COLLECTION_REQUIRED');
});
