import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4ResearchThenOOS} from './p4-research-then-oos.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
const hour=3600000;
const candles=Array.from({length:150},(_,i)=>{const p=i<25?100:100+i*0.5;return {symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*hour-1,open:p,high:p+1,low:p-1,close:p,volume:1000}});
test('real research loop keeps reserved OOS candles unseen if no challenger qualifies',async()=>{
 let maxFeatureTime=-1;
 const result=await runP4ResearchThenOOS({
  candles,championVersion:'champion',championParameters:DEFAULT_TRAINING_PARAMETERS,
  iterations:1,seed:7,costs:{feeRate:0.001,slippageRate:0.001},
  featureAtDecision:async({candidate})=>{maxFeatureTime=Math.max(maxFeatureTime,candidate.decisionTime);return {asOfMs:candidate.decisionTime,rsi:55,atrPercent:0.02,volumeRatio:1.2,trendStrength:0.4,momentum:0.03}},
  brain:async()=>({action:'WAIT',reason:'NO_TRADE_RESEARCH'})
 });
 assert.equal(result.status,'NO_CHALLENGER_SELECTED');
 assert.equal(result.research.completedIterations,1);
 assert.equal(result.partition.researchCount,120);
 assert.equal(result.partition.validationCount,30);
 assert(maxFeatureTime<=result.partition.boundary.researchEndMs);
 assert.equal(result.independentValidationPassed,false);
 assert.equal(result.promotionAllowed,false);
});
