import test from "node:test";
import assert from "node:assert/strict";
import {loadHistoricalCandles} from "./p2-historical-reader.mjs";
import {replayCandles} from "./p2-replay.mjs";
// Read-only Supabase BTCUSDT 15m sample, captured from raw_candles; no synthetic OHLC.
const samples=[
[1792137600000,1792138499999,"82289.99","82360.01","82248.27","82256.88"],
[1792138500000,1792139399999,"82256.88","82290.70","82168.00","82269.31"],
[1792139400000,1792140299999,"82269.31","82368.01","82198.00","82319.18"],
[1792140300000,1792141199999,"82319.18","82388.00","82248.08","82248.09"],
[1792141200000,1792142099999,"82248.08","82280.01","82164.39","82272.31"],
[1792142100000,1792142999999,"82272.32","82272.32","82134.45","82160.00"]
];
const rows=samples.map(([open_time,close_time,open_price,high_price,low_price,close_price])=>({source:"BINANCE",market:"SPOT",symbol:"BTCUSDT",timeframe:"15m",open_time,close_time,open_price,high_price,low_price,close_price}));
test("real Supabase BTC candles paginate and replay without data mutation",async()=>{
 const before=JSON.stringify(rows);let pages=0;
 const candles=await loadHistoricalCandles({symbol:"BTCUSDT",timeframe:"15m",fromOpenTime:1792137600000,toOpenTime:1792142100000,asOfMs:1792143000000,pageSize:2,fetchPage:async({afterOpenTime,toOpenTime,limit})=>{pages++;return rows.filter(r=>r.open_time>afterOpenTime&&r.open_time<=toOpenTime).slice(0,limit)}});
 assert.equal(pages,4);assert.equal(candles.length,6);
 const replay=replayCandles({candles,costs:{feeRate:0,slippageRate:0}});
 assert.equal(replay.processedCandles,6);assert.equal(replay.equitySnapshots.length,6);assert.equal(replay.account.equity,10000);assert.equal(replay.metrics.closedTrades,0);
 assert.equal(JSON.stringify(rows),before);
});
