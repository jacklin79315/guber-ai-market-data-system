import test from "node:test";
import assert from "node:assert/strict";
import {replayCandles} from "./p2-replay.mjs";
const candle=(symbol,closeTime,low=99,high=101,close=100)=>({symbol,timeframe:"1h",closeTime,open:100,low,high,close});
const proposal=(id,symbol,capital=2000)=>({id,symbol,timeframe:"1h",side:"LONG",decisionIndex:0,entry:[99,101],takeProfit:[110,111],stopLoss:[90,91],capital});
const run=(candles,proposals)=>replayCandles({candles,proposals,costs:{feeRate:0,slippageRate:0}});
test("replay sorts unordered multi-symbol closed candles",()=>{
 const candles=[candle("ETHUSDT",2),candle("BTCUSDT",2),candle("ETHUSDT",1),candle("BTCUSDT",1)];
 const proposals=[proposal("eth","ETHUSDT"),proposal("btc","BTCUSDT")];
 const a=run(candles,proposals),b=run([...candles].reverse(),[...proposals].reverse());
 assert.deepEqual(a.events,b.events);assert.equal(a.account.positions.length,2);
});
test("replay does not fill a proposal on its decision candle",()=>{
 const a=run([candle("BTCUSDT",1)],[proposal("btc","BTCUSDT")]);
 assert.equal(a.account.positions.length,0);assert.equal(a.account.pending.length,1);
});
test("same timestamp capital contention uses stable symbol order",()=>{
 const candles=[candle("ETHUSDT",1),candle("BTCUSDT",1),candle("ETHUSDT",2),candle("BTCUSDT",2)];
 const a=run(candles,[proposal("eth","ETHUSDT",6000),proposal("btc","BTCUSDT",6000)]);
 assert.equal(a.account.positions.length,1);assert.equal(a.account.positions[0].symbol,"BTCUSDT");
});
test("duplicate candle timestamps for same symbol are rejected",()=>{
 assert.throws(()=>run([candle("BTCUSDT",1),candle("BTCUSDT",1)],[]),/duplicate candle/);
});

test("replay preserves exact snapshot count across multiple symbols and timestamps",()=>{
 const candles=[];
 for(let t=1;t<=25;t++)for(const symbol of ["BTCUSDT","ETHUSDT","SOLUSDT"])candles.push(candle(symbol,t));
 const a=run(candles,[]);
 assert.equal(a.processedCandles,75);
 assert.equal(a.equitySnapshots.length,25);
 assert.equal(a.equityMetrics.maxDrawdown,0);
});

test("final replay snapshot reconciles equity, cash and total return",()=>{const candles=[candle("BTCUSDT",1),candle("ETHUSDT",1),candle("BTCUSDT",2),candle("ETHUSDT",2),candle("BTCUSDT",3,105,111,110),{...candle("ETHUSDT",3,89,95,90),open:95}];const a=replayCandles({candles,proposals:[proposal("btc","BTCUSDT"),proposal("eth","ETHUSDT")],costs:{feeRate:0.001,slippageRate:0.001}});const last=a.equitySnapshots.at(-1);assert.equal(a.equitySnapshots.length,3);assert.equal(a.account.closed.length,2);assert.ok(Math.abs(last.equity-a.account.equity)<1e-7);assert.ok(Math.abs(last.cash-a.account.cash)<1e-7);assert.ok(Math.abs(a.equityMetrics.endingEquity-a.account.equity)<1e-7);assert.ok(Math.abs(a.equityMetrics.totalReturn-(a.account.equity/a.account.initialCapital-1))<1e-9);assert.ok(Math.abs(a.account.cash-(a.account.initialCapital+a.metrics.netRealizedPnl))<1e-7)});
