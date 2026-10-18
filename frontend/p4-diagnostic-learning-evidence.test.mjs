import test from 'node:test';
import assert from 'node:assert/strict';
import {extractP4DiagnosticLearningEvidence} from './p4-diagnostic-learning-evidence.mjs';
import {summarizeP4DiagnosticResearch} from './p4-diagnostic-research-summary.mjs';
const feedback=(c,h,status='RESEARCH_EVIDENCE_ONLY')=>({status,champion:{netRealizedPnl:c},challenger:{netRealizedPnl:h}});
test('negative OOS evidence does not become learned improvement',()=>{
 const result={status:'OOS_RESEARCH_EVALUATED',loadedCandles:2000,selectedArm:{parameter:'entryLookback',from:20,to:19},trainingBatch:{taskId:'COLLECT_ENTRY_CAUSAL_EVIDENCE',results:[{arm:{parameter:'entryLookback',to:19},feedback:feedback(-80,-39)}]},validationResult:{feedback:feedback(5.59,2.85,'INSUFFICIENT_RESEARCH_SAMPLES')},oosReplayEvaluated:true};
 const summary=summarizeP4DiagnosticResearch({result,jobId:'learning_1',createdAtMs:1});
 assert.equal(summary.learningEvidence.trainingNetPnlDelta,41);
 assert.ok(summary.learningEvidence.oosNetPnlDelta<0);
 assert.equal(summary.learningEvidence.assessment,'INSUFFICIENT_OOS_EVIDENCE');
 assert.equal(summary.learningEvidence.learnedModelUpdated,false);
});
test('missing results never invent improvement',()=>{
 const e=extractP4DiagnosticLearningEvidence({});
 assert.equal(e.assessment,'NO_SELECTED_HYPOTHESIS');assert.equal(e.trainingNetPnlDelta,null);assert.equal(e.oosNetPnlDelta,null);
});
