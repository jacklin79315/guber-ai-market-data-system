import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4ChronologicalDiagnosticResearch} from './p4-diagnostic-chronological-run.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
test('chronological entry point uses earlier research and later validation without promotion',async()=>{
 const candles=Array.from({length:140},(_,i)=>({closeTime:i+1}));
 const result=await runP4ChronologicalDiagnosticResearch({candles,task:{id:'CALIBRATE_UNKNOWN_WIN_PROBABILITY',actor:'Win',sampleCount:30},parentParameters:DEFAULT_TRAINING_PARAMETERS});
 assert.equal(result.partition.trainCandles,110);
 assert.equal(result.partition.validationCandles,30);
 assert.equal(result.trainWindow.to,110);
 assert.equal(result.validationWindow.from,111);
 assert.equal(result.independentValidation,false);
 assert.equal(result.championPromotionAllowed,false);
});
test('rejects insufficient history and injected windows',async()=>{
 await assert.rejects(()=>runP4ChronologicalDiagnosticResearch({candles:[{closeTime:1}]}),/insufficient/);
 await assert.rejects(()=>runP4ChronologicalDiagnosticResearch({candles:[],trainCandles:[]}),/override forbidden/);
});

test('35 percent OOS keeps chronology and does not authorize promotion',async()=>{
 const candles=Array.from({length:2000},(_,i)=>({closeTime:(i+1)*3600000}));
 const result=await runP4ChronologicalDiagnosticResearch({candles,validationFraction:0.35,task:{id:'COLLECT_ENTRY_CAUSAL_EVIDENCE',actor:'Entry',sampleCount:30},parentParameters:DEFAULT_TRAINING_PARAMETERS,maxArms:1});
 assert.equal(result.partition.trainCandles,1300);
 assert.equal(result.partition.validationCandles,700);
 assert.equal(result.trainWindow.to,1300*3600000);
 assert.equal(result.validationWindow.from,1301*3600000);
 assert.equal(result.championPromotionAllowed,false);
 assert.equal(result.independentValidation,false);
});
