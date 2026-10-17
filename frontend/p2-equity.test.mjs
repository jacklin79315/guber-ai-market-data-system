import test from "node:test";
import assert from "node:assert/strict";
import {equityMetrics} from "./p2-equity.mjs";
import {replayCandles} from "./p2-replay.mjs";
test("drawdown uses historical peak, not only initial capital",()=>{
 const s=[{closeTime:1,equity:11000},{closeTime:2,equity:8800},{closeTime:3,equity:10000}];
 const m=equityMetrics(s,10000);
 assert.ok(Math.abs(m.maxDrawdown-0.2)<1e-12);
 assert.equal(m.totalReturn,0);
});
test("annualized return requires actual elapsed time",()=>{
 assert.equal(equityMetrics([{closeTime:1,equity:10000}],10000).annualizedReturn,null);
 const m=equityMetrics([{closeTime:0,equity:10000},{closeTime:365.25*86400000,equity:11000}],10000);
 assert.ok(Math.abs(m.annualizedReturn-0.1)<1e-12);
});
test("replay records one snapshot per unique close time",()=>{
 const candles=["BTCUSDT","ETHUSDT"].flatMap(symbol=>[1,2].map(closeTime=>({symbol,timeframe:"1h",closeTime,open:100,high:101,low:99,close:100})));
 const r=replayCandles({candles,costs:{feeRate:0,slippageRate:0}});
 assert.equal(r.equitySnapshots.length,2);
 assert.equal(r.equityMetrics.totalReturn,0);
 assert.equal(r.equityMetrics.snapshotCount,2);
});
test("reject nonchronological snapshots",()=>assert.throws(()=>equityMetrics([{closeTime:1,equity:10000},{closeTime:1,equity:9000}],10000),/invalid equity snapshot/));
