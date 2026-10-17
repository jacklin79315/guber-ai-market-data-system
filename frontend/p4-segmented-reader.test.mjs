import test from 'node:test';
import assert from 'node:assert/strict';
import {loadP4SegmentedHistoricalCandles} from './p4-segmented-reader.mjs';
const hour=3600000;
const row=t=>({source:'BINANCE',market:'SPOT',symbol:'BTCUSDT',timeframe:'1h',open_time:t,close_time:t+hour-1,open_price:'100',high_price:'101',low_price:'99',close_price:'100'});
const base={supabaseUrl:'https://example.supabase.co',apiKey:'public-test',symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:0,toOpenTime:6*hour,asOfMs:8*hour,maxCandlesPerWindow:3};
test('P4 segmented reader reports progress and verifies every native candle',async()=>{const progress=[];const result=await loadP4SegmentedHistoricalCandles({...base,onProgress:x=>progress.push(x),fetchImpl:async url=>{const q=new URL(url);const after=Number(q.searchParams.get('open_time').slice(3));const end=Number(q.searchParams.get('open_time').slice(3));return {ok:true,json:async()=>Array.from({length:7},(_,i)=>row(i*hour)).filter(r=>r.open_time>after&&r.open_time<=Number(q.searchParams.get('open_time_lte')||6*hour)).slice(0,Number(q.searchParams.get('limit')||1000))}}});assert.equal(result.verified,true);assert.equal(result.loadedCandles,7);assert.equal(progress.length,3)});
test('P4 segmented reader supports stop before fetching',async()=>{const r=await loadP4SegmentedHistoricalCandles({...base,shouldStop:()=>true,fetchImpl:async()=>{throw Error('unexpected fetch')}});assert.equal(r.status,'STOPPED');assert.equal(r.completedWindows,0)});
