import test from 'node:test';
import assert from 'node:assert/strict';
import {runSequentialHistoricalReplay} from './p3-sequential-historical-replay.mjs';
const hour=3600000;
const rows=Array.from({length:25},(_,i)=>{const c=i<20?100:105+i-20;return {source:'BINANCE',market:'SPOT',symbol:'BTCUSDT',timeframe:'1h',open_time:i*hour,close_time:(i+1)*hour-1,open_price:String(c),high_price:String(c+1),low_price:String(c-1),close_price:String(c)}});
const base={symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:0,toOpenTime:24*hour,asOfMs:25*hour,fetchPage:async({afterOpenTime,toOpenTime,limit})=>rows.filter(r=>r.open_time>afterOpenTime&&r.open_time<=toOpenTime).slice(0,limit),featureAtDecision:async({candidate})=>({asOfMs:candidate.decisionTime,rsi:55,atrPercent:0.02,volumeRatio:1.2,trendStrength:0.4,momentum:0.03}),brain:async()=>({action:'WAIT',reason:'research only'}),costs:{feeRate:0.001,slippageRate:0.001}};
test('historical candles feed sequential five-expert research',async()=>{const r=await runSequentialHistoricalReplay(base);assert.equal(r.loadedCandles,25);assert.equal(r.processedCandles,25);assert.ok(r.decisions.length>0);assert.equal(r.approvedCount,0);assert.equal(r.account.closed.length,0)});
test('explicit Brain provider required',async()=>{await assert.rejects(runSequentialHistoricalReplay({...base,brain:undefined}),/explicit feature and Brain providers required/)});
test('future features rejected',async()=>{await assert.rejects(runSequentialHistoricalReplay({...base,featureAtDecision:async({candidate})=>({asOfMs:candidate.decisionTime+1})}),/future or undated/)});
