import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeP4DiagnosticResearch} from './p4-diagnostic-research-summary.mjs';
test('compact summary excludes raw diagnostic replay evidence and disallows promotion',()=>{
 const result=summarizeP4DiagnosticResearch({jobId:'research_1',createdAtMs:1,result:{status:'NO_TRAIN_SELECTED_ARM',trainingBatch:{taskId:'task',plannedArms:0,completedArms:0,results:[]},diagnosticEvidence:{secret:'huge'}}});
 assert.equal(result.taskId,'task');
 assert.equal(result.ordersEnabled,false);
 assert.equal(result.independentValidation,false);
 assert.equal(result.modelUpdateApplied,false);
 assert.equal(JSON.stringify(result).includes('secret'),false);
});

test('OOS evidence distinguishes missing samples from an actual validated improvement',()=>{
 const base={jobId:'research_2',createdAtMs:2,result:{status:'OOS_RESEARCH_EVALUATED',oosReplayEvaluated:true,oosImprovedInReplay:false,validationResult:{feedback:{status:'INSUFFICIENT_RESEARCH_SAMPLES'}}}};
 const insufficient=summarizeP4DiagnosticResearch(base);
 assert.equal(insufficient.oosEvidenceStatus,'INSUFFICIENT_OOS_SAMPLES');
 assert.equal(insufficient.championPromotionAllowed,false);
 const worse=summarizeP4DiagnosticResearch({...base,result:{...base.result,validationResult:{feedback:{status:'RESEARCH_EVIDENCE_ONLY'}}}});
 assert.equal(worse.oosEvidenceStatus,'OOS_NOT_IMPROVED');
 const improved=summarizeP4DiagnosticResearch({...base,result:{...base.result,oosImprovedInReplay:true,validationResult:{feedback:{status:'RESEARCH_EVIDENCE_ONLY'}}}});
 assert.equal(improved.oosEvidenceStatus,'OOS_IMPROVED_RESEARCH_ONLY');
 assert.equal(improved.independentValidationPassed,false);
});

test('completed diagnostic summary carries a durable non-executable follow-up plan',()=>{
 const result=summarizeP4DiagnosticResearch({jobId:'round_2000',createdAtMs:3,result:{status:'OOS_RESEARCH_EVALUATED',loadedCandles:2000,trainingBatch:{taskId:'COLLECT_ENTRY_CAUSAL_EVIDENCE',plannedArms:1,completedArms:1,results:[]},selectedArm:{parameter:'entryLookback',from:20,to:19},oosReplayEvaluated:true,oosImprovedInReplay:false,validationResult:{feedback:{status:'INSUFFICIENT_RESEARCH_SAMPLES'}}}});
 assert.equal(result.followUpPlan.sourceJobId,'round_2000');
 assert.equal(result.followUpPlan.action,'COLLECT_MORE_UNTOUCHED_OOS_EVIDENCE');
 assert.equal(result.followUpPlan.autoExecutionAuthorized,false);
 assert.equal(result.followUpPlan.ordersEnabled,false);
 assert.equal(result.championPromotionAllowed,false);
});

test('research summary retains OOS sample counts without falsely declaring sufficiency',()=>{
 const s=summarizeP4DiagnosticResearch({jobId:'oos_count',createdAtMs:10,result:{status:'OOS_RESEARCH_EVALUATED',oosReplayEvaluated:true,validationResult:{feedback:{status:'INSUFFICIENT_RESEARCH_SAMPLES',champion:{closedTrades:24},challenger:{closedTrades:24}}}}});
 assert.deepEqual(s.validationTradeCounts,{champion:24,challenger:24,requiredMinimum:30});
 assert.equal(s.oosEvidenceStatus,'INSUFFICIENT_OOS_SAMPLES');
});
