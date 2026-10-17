import test from "node:test";import assert from "node:assert/strict";import {gapSummary} from "./candle-gaps.js";
const interval=3600000;const start=1790000000000;
test("hourly gap counts are based on native one-hour intervals",()=>{const rows=[0,1,4,5].map(i=>({open_time:start+i*interval}));const result=gapSummary(rows,"1h");assert.deepEqual({missing:result.missing,discontinuities:result.discontinuities},{missing:2,discontinuities:1})});
test("a daily timeframe does not treat a one-hour candle as valid",()=>{const rows=[{open_time:start},{open_time:start+interval}];assert.equal(gapSummary(rows,"1d"),null)});
test("reversed raw candle results are sorted without changing gap counts",()=>{const rows=[4,2,1,0].map(i=>({open_time:start+i*interval}));assert.equal(gapSummary(rows,"1h").missing,1)});
