import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4DiagnosticOosExperiment} from './p4-diagnostic-oos-experiment.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
const candle=t=>({closeTime:t});
test('rejects overlapping or nonmonotonic train/validation windows before any replay',async()=>{
 const base={task:{id:'COLLECT_ENTRY_CAUSAL_EVIDENCE',actor:'Entry',priority:'MEDIUM',sampleCount:30},parentParameters:DEFAULT_TRAINING_PARAMETERS};
 await assert.rejects(()=>runP4DiagnosticOosExperiment({...base,trainCandles:[candle(1),candle(2)],validationCandles:[candle(2),candle(3)]}),/overlap/);
 await assert.rejects(()=>runP4DiagnosticOosExperiment({...base,trainCandles:[candle(2),candle(1)],validationCandles:[candle(3),candle(4)]}),/unordered/);
});
test('empty hypothesis task does not inspect OOS or promote model',async()=>{
 const result=await runP4DiagnosticOosExperiment({task:{id:'CALIBRATE_UNKNOWN_WIN_PROBABILITY',actor:'Win',sampleCount:30},parentParameters:DEFAULT_TRAINING_PARAMETERS,trainCandles:[candle(1),candle(2)],validationCandles:[candle(3),candle(4)]});
 assert.equal(result.status,'NO_TRAIN_SELECTED_ARM');
 assert.equal(result.validationResult,null);
 assert.equal(result.independentValidation,false);
 assert.equal(result.oosReplayEvaluated,false);
 assert.equal(result.independentValidationPassed,false);
 assert.equal(result.championPromotionAllowed,false);
});

test('forbids injecting a replay candle window or callback into OOS selection',async()=>{
 const options={task:{id:'CALIBRATE_UNKNOWN_WIN_PROBABILITY',actor:'Win',sampleCount:30},parentParameters:DEFAULT_TRAINING_PARAMETERS,trainCandles:[candle(1),candle(2)],validationCandles:[candle(3),candle(4)]};
 await assert.rejects(()=>runP4DiagnosticOosExperiment({...options,candles:[candle(9)]}),/override forbidden/);
 await assert.rejects(()=>runP4DiagnosticOosExperiment({...options,onExperiment:()=>{}}),/override forbidden/);
});
