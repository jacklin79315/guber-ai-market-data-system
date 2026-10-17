import test from 'node:test';import assert from 'node:assert/strict';
import {runP4PatternResearchThenOOS} from './p4-pattern-research-then-oos.mjs';
import {planP4PatternExperiments} from './p4-pattern-experiments.mjs';
import {DEFAULT_TRAINING_PARAMETERS as params} from './p4-challenger-parameters.mjs';
const hour=3600000,candles=Array.from({length:150},(_,i)=>{const p=100+i*.1;return {symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*hour-1,open:p,high:p+1,low:p-1,close:p,volume:1000}});
const report={schemaVersion:'P4_DIAGNOSTIC_PATTERN_REPORT_V1',auditFingerprint:'a'.repeat(64),patterns:[{schemaVersion:'P4_DIAGNOSTIC_PATTERN_V1',evidenceId:'event-set',actor:'Entry',status:'HYPOTHESIS_FOR_CAUSAL_REVIEW',supportingEvents:30}]};
const plan=planP4PatternExperiments({report,parentParameters:params});
test('diagnostic research never touches OOS candles when no candidate qualifies',async()=>{
 let maxFeature=-1;
 const result=await runP4PatternResearchThenOOS({candles,plan,parentVersion:'champion',parentParameters:params,
 featureAtDecision:async({candidate})=>{maxFeature=Math.max(maxFeature,candidate.decisionTime);return {asOfMs:candidate.decisionTime,rsi:55,atrPercent:.02,volumeRatio:1.2,trendStrength:.4,momentum:.03}},
 brain:async()=>({action:'WAIT',reason:'NO_TRADE'}),costs:{feeRate:.001,slippageRate:.001}});
 assert.equal(result.status,'NO_ELIGIBLE_CHALLENGER_OOS_UNTOUCHED');assert.equal(result.partition.researchCount,120);assert.equal(result.partition.validationCount,30);
 assert(maxFeature<=result.partition.boundary.researchEndMs);assert.equal(result.promotionAllowed,false);
});
test('rejects injected partition candles before research',async()=>{
 await assert.rejects(runP4PatternResearchThenOOS({candles,partitionOptions:{candles:[]}}),/override/);
});
