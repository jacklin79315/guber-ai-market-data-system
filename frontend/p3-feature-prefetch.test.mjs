import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseFeatureAtDecision} from './p3-supabase-feature-reader.mjs';
const makeRow=t=>({source:'BINANCE',market:'SPOT',symbol:'BTCUSDT',timeframe:'1h',open_time:t-3600000,close_time:t,rsi_12:50,atr_percent:1,volume_ratio:1,adx_14:20,return_3:0});
test('paginated prefetch serves replay without individual GETs',async()=>{
 const times=[7200000,10800000,14400000];let calls=0;
 const reader=createSupabaseFeatureAtDecision({supabaseUrl:'https://example.supabase.co',apiKey:'test',fetchImpl:async url=>{calls++;const u=new URL(url);assert.equal(u.pathname,'/rest/v1/market_features');const offset=Number(u.searchParams.get('offset')||0);const size=Number(u.searchParams.get('limit'));return {ok:true,json:async()=>times.slice(offset,offset+size).map(makeRow)}}});
 assert.deepEqual(await reader.prefetch({symbol:'BTCUSDT',timeframe:'1h',fromCloseTime:7200000,toCloseTime:14400000,pageSize:2}),{loaded:3});
 assert.equal((await reader({candidate:{symbol:'BTCUSDT',timeframe:'1h',decisionTime:10800000}})).rsi,50);
 assert.equal(calls,2);
});
test('prefetch rejects duplicate timestamps',async()=>{
 const reader=createSupabaseFeatureAtDecision({supabaseUrl:'https://example.supabase.co',apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>[makeRow(7200000),makeRow(7200000)]})});
 await assert.rejects(reader.prefetch({symbol:'BTCUSDT',timeframe:'1h',fromCloseTime:7200000,toCloseTime:14400000}),/duplicate/);
});
