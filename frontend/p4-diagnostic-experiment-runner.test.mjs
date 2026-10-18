import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4DiagnosticExperiments} from './p4-diagnostic-experiment-runner.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
test('nonparameter diagnostic task completes safely without trading or mutation',async()=>{
 const result=await runP4DiagnosticExperiments({task:{id:'CALIBRATE_UNKNOWN_WIN_PROBABILITY',actor:'Win',sampleCount:30},parentParameters:DEFAULT_TRAINING_PARAMETERS});
 assert.equal(result.status,'EXPLORATORY_BATCH_COMPLETED');
 assert.equal(result.plannedArms,0);
 assert.equal(result.completedArms,0);
 assert.equal(result.ordersEnabled,false);
 assert.equal(result.modelUpdateApplied,false);
});
test('bounded diagnostic experiments respect stop before first replay',async()=>{
 const result=await runP4DiagnosticExperiments({task:{id:'COLLECT_ENTRY_CAUSAL_EVIDENCE',actor:'Entry',priority:'MEDIUM',sampleCount:30},parentParameters:DEFAULT_TRAINING_PARAMETERS,shouldStop:()=>true});
 assert.equal(result.plannedArms,4);
 assert.equal(result.completedArms,0);
 assert.equal(result.status,'EXPLORATORY_BATCH_STOPPED');
});
