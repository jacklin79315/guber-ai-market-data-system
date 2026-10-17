import test from "node:test";
import assert from "node:assert/strict";
import {FRAME_MS,assessCandleFreshness} from "./candle-freshness.js";
test("four native Binance frames",()=>assert.deepEqual(Object.keys(FRAME_MS),["15m","1h","4h","1d"]));
test("millisecond close_time is fresh at boundary",()=>{const now=1800000000000;assert.equal(assessCandleFreshness(now-900000*2.5,"15m",now).state,"正常");assert.equal(assessCandleFreshness(now-900000*3,"15m",now).state,"可能延遲")});
test("reject missing and future close times",()=>{assert.equal(assessCandleFreshness(null,"1h").state,"無資料");assert.equal(assessCandleFreshness("invalid","1h").state,"時間異常");assert.equal(assessCandleFreshness(1800000002000,"1h",1800000000000).state,"時間異常")});
test("ISO and numeric timestamps are supported",()=>{const now=Date.parse("2026-10-17T00:00:00Z");assert.equal(assessCandleFreshness("2026-10-16T23:00:00Z","1h",now).state,"正常");assert.equal(assessCandleFreshness(String(now-3600000),"1h",now).state,"正常")});
