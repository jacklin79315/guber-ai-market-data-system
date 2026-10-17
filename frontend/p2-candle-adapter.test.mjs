import test from "node:test";
import assert from "node:assert/strict";
import {adaptRawCandles} from "./p2-candle-adapter.mjs";
const row=(overrides={})=>({source:"BINANCE",market:"SPOT",symbol:"BTCUSDT",timeframe:"15m",open_time:1792230300000,close_time:1792231199999,open_price:"81673.55",high_price:"81742.76",low_price:"81590.21",close_price:"81610.31",...overrides});
test("Supabase raw row maps millisecond close time and numeric OHLC",()=>{const [c]=adaptRawCandles([row()],{asOfMs:1792231200000});assert.equal(c.closeTime,1792231199999);assert.equal(c.open,81673.55);assert.equal(c.close,81610.31)});
test("unclosed candle is excluded by rejecting it",()=>assert.throws(()=>adaptRawCandles([row()],{asOfMs:1792231199999}),/unclosed/));
test("invalid OHLC and interval duration are rejected",()=>{assert.throws(()=>adaptRawCandles([row({open_price:"90000"})],{asOfMs:1792231200000}),/OHLC/);assert.throws(()=>adaptRawCandles([row({close_time:1792231199000})],{asOfMs:1792231200000}),/time/)});
test("duplicate rows are rejected",()=>assert.throws(()=>adaptRawCandles([row(),row()],{asOfMs:1792231200000}),/duplicate/));
