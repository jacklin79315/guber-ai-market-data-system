import test from 'node:test';
import assert from 'node:assert/strict';
import {compareP4GuidanceModes} from './p4-guidance-ab-comparison.mjs';
const hour=3600000;
const candles=Array.from({length:160},(_,i)=>({symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*hour-1,open:100+i*.1,high:101+i*.1,low:99+i*.1,close:100+i*.1}));
const options={candles,championVersion:'champion',championParameters:{entryLookback:20,entryThreshold:.001,rewardAtrPeriod:14,rewardStopAtr:1.5,rewardTakeAtr:3},iterations:1,seed:17,featureAtDecision:async({candidate})=>({asOfMs:candidate.decisionTime,rsi:55,atrPercent:.02,volumeRatio:1.2,trendStrength:.4,momentum:.03}),brain:async()=>({action:'WAIT',reason:'AB fixture'}),costs:{feeRate:.001,slippageRate:.001}};
test('paired guidance experiment freezes both arms and reports insufficient OOS samples honestly',async()=>{
 const r=await compareP4GuidanceModes(options);
 assert.equal(r.guided.explorationMode,'DIAGNOSTIC_GUIDED');
 assert.equal(r.unguided.explorationMode,'UNGUIDED');
 assert.equal(r.guided.partition.boundary.validationStartMs,r.unguided.partition.boundary.validationStartMs);
 assert.equal(r.comparable,false);
 assert.equal(r.selectedOosNetPnlDifference,null);
 assert.equal(r.promotionAllowed,false);
});
test('paired experiment forbids externally injecting a single-arm exploration mode',async()=>{await assert.rejects(compareP4GuidanceModes({...options,explorationMode:'UNGUIDED'}),/invalid P4 guidance/)});
