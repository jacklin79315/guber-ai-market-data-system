import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateP4FrozenOOS} from './p4-frozen-oos.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
const hour=3600000;
const candles=Array.from({length:50},(_,i)=>{const p=i<25?100:100+i*0.2;return {symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+101)*hour-1,open:p,high:p+1,low:p-1,close:p,volume:1000}});
test('frozen OOS runs both real replays without promotion or parameter mutation',async()=>{
 const parent=structuredClone(DEFAULT_TRAINING_PARAMETERS);
 const candidate={...parent,entryLookback:21};
 const champion={version:'champion',parameters:parent},challenger={version:'candidate',parameters:candidate};
 let maxSeen=-1;
 const run=()=>evaluateP4FrozenOOS({
  researchBoundary:{researchEndMs:100*hour-1,validationStartMs:101*hour-1},
  validationCandles:candles,champion,challenger,
  featureAtDecision:async({candidate})=>{maxSeen=Math.max(maxSeen,candidate.decisionTime);return {asOfMs:candidate.decisionTime,rsi:55,atrPercent:0.02,volumeRatio:1.2,trendStrength:0.4,momentum:0.03}},
  brain:async()=>({action:'WAIT',reason:'RESEARCH_HOLD'}),
  costs:{feeRate:0.001,slippageRate:0.001}
 });
 const a=await run(),b=await run();
 assert.equal(a.status,'OOS_REPLAY_COMPLETED_REVIEW_REQUIRED');
 assert.equal(a.comparison.champion.processedCandles,50);
 assert.equal(a.comparison.challenger.processedCandles,50);
 assert.equal(a.frozenFingerprint,b.frozenFingerprint);
 assert.equal(a.independentValidationPassed,false);
 assert.equal(a.promotionAllowed,false);
 assert.deepEqual(champion.parameters,parent);
 assert.deepEqual(challenger.parameters,candidate);
 assert(maxSeen<=candles.at(-1).closeTime);
});
