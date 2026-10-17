import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseFeatureAtDecision} from './p3-supabase-feature-reader.mjs';
const candidate={symbol:'BTCUSDT',timeframe:'1h',decisionTime:7200000};
const row={source:'BINANCE',market:'SPOT',symbol:'BTCUSDT',timeframe:'1h',open_time:3600000,close_time:7200000,rsi_12:50,atr_percent:1,volume_ratio:1.2,adx_14:30,return_3:0.02};
test('validated decision-time features are reused across iterations without mutable shared objects',async()=>{
 let calls=0;
 const reader=createSupabaseFeatureAtDecision({supabaseUrl:'https://example.supabase.co',apiKey:'test',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>[row]}}});
 const [first,second]=await Promise.all([reader({candidate}),reader({candidate})]);
 first.rsi=999;
 assert.equal(second.rsi,50);
 assert.equal((await reader({candidate})).rsi,50);
 assert.equal(calls,1);
});
test('failed reads are not cached and can be retried',async()=>{
 let calls=0;
 const reader=createSupabaseFeatureAtDecision({supabaseUrl:'https://example.supabase.co',apiKey:'test',fetchImpl:async()=>{calls++;return {ok:calls>1,status:503,json:async()=>[row]}}});
 await assert.rejects(reader({candidate}),/503/);
 assert.equal((await reader({candidate})).rsi,50);
 assert.equal(calls,2);
});
