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
