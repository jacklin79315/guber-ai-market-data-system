import test from 'node:test';
import assert from 'node:assert/strict';
import {runSequentialFiveExpertReplay} from './p3-sequential-replay.mjs';
const candles=Array.from({length:25},(_,i)=>{const c=i<20?100:105+i-20;return {symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*3600000-1,open:c,high:c+1,low:c-1,close:c}});
const features={rsi:55,atrPercent:0.02,volumeRatio:1.2,trendStrength:0.4,momentum:0.03};
const opts={candles,costs:{feeRate:0.001,slippageRate:0.001},featureAtDecision:async({candidate})=>({...features,asOfMs:candidate.decisionTime}),historyAtDecision:async()=>({tradeHistory:[],holdingHistory:[]}),brain:async()=>({action:'WAIT',reason:'research'}),minProbabilitySamples:3};
test('no historical samples means no simulated orders',async()=>{const result=await runSequentialFiveExpertReplay(opts);assert.equal(result.approvedCount,0);assert.equal(result.account.closed.length,0)});
test('future features are refused',async()=>{await assert.rejects(runSequentialFiveExpertReplay({...opts,featureAtDecision:async({candidate})=>({...features,asOfMs:candidate.decisionTime+1})}),/future or undated/)});
