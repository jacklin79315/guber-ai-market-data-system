import test from 'node:test';import assert from 'node:assert/strict';
import {runP4PatternResearch} from './p4-pattern-research.mjs';
import {planP4PatternExperiments} from './p4-pattern-experiments.mjs';
import {DEFAULT_TRAINING_PARAMETERS as params} from './p4-challenger-parameters.mjs';
const hour=3600000;
const candles=Array.from({length:60},(_,i)=>{const p=100+i*.1;return {symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*hour-1,open:p,high:p+1,low:p-1,close:p,volume:1000}});
const report={schemaVersion:'P4_DIAGNOSTIC_PATTERN_REPORT_V1',auditFingerprint:'a'.repeat(64),patterns:[{schemaVersion:'P4_DIAGNOSTIC_PATTERN_V1',evidenceId:'event-set',actor:'Entry',status:'HYPOTHESIS_FOR_CAUSAL_REVIEW',supportingEvents:30}]};
test('diagnostic experiments execute real paper replays without automatic learning',async()=>{
 const plan=planP4PatternExperiments({report,parentParameters:params});
 const result=await runP4PatternResearch({plan,parentVersion:'champion',parentParameters:params,candles,
  featureAtDecision:async({candidate})=>({asOfMs:candidate.decisionTime,rsi:55,atrPercent:.02,volumeRatio:1.2,trendStrength:.4,momentum:.03}),
  brain:async()=>({action:'WAIT',reason:'NO_TRADE'}),costs:{feeRate:.001,slippageRate:.001}});
 assert.equal(result.results.length,4);
 assert(result.results.every(x=>x.feedback.status==='INSUFFICIENT_RESEARCH_SAMPLES'&&!x.promotionAllowed));
 assert.equal(result.appliedToModels,false);assert.equal(params.entryLookback,20);
});
test('rejects experiment with mismatched direction',async()=>{
 const plan=planP4PatternExperiments({report,parentParameters:params});
 plan.experiments[0].direction=1;
 await assert.rejects(runP4PatternResearch({plan,parentVersion:'champion',parentParameters:params,candles}),/delta/);
});
