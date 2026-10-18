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
