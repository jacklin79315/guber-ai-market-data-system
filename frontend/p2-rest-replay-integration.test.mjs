import test from "node:test";
import assert from "node:assert/strict";
import {createSupabaseCandlePageFetcher,loadHistoricalCandles} from "./p2-historical-reader.mjs";
import {replayCandles} from "./p2-replay.mjs";
const raw=[0,1,2,3,4].map(i=>({source:"BINANCE",market:"SPOT",symbol:"BTCUSDT",timeframe:"15m",open_time:900000+i*900000,close_time:1799999+i*900000,open_price:"100",high_price:"101",low_price:"99",close_price:"100"}));
test("GET Supabase REST pagination feeds P2 replay end to end without writes",async()=>{
 const requests=[];
 const fetchImpl=async(url,options)=>{const u=new URL(url);requests.push({u,options});assert.equal(options.method,"GET");assert.equal(u.pathname,"/rest/v1/raw_candles");assert.equal(u.searchParams.get("symbol"),"eq.BTCUSDT");assert.equal(u.searchParams.get("timeframe"),"eq.15m");const after=Number(u.searchParams.get("open_time").slice(3));const until=Number(u.searchParams.get("and").match(/lte\.(\d+)/)[1]);const limit=Number(u.searchParams.get("limit"));return {ok:true,json:async()=>raw.filter(r=>r.open_time>after&&r.open_time<=until).slice(0,limit)}};
 const fetchPage=createSupabaseCandlePageFetcher({supabaseUrl:"https://example.supabase.co",anonKey:"test-publishable",fetchImpl});
 const candles=await loadHistoricalCandles({fetchPage,symbol:"BTCUSDT",timeframe:"15m",fromOpenTime:900000,toOpenTime:4500000,asOfMs:6000000,pageSize:2});
 const result=replayCandles({candles,costs:{feeRate:0,slippageRate:0}});
 assert.equal(requests.length,3);assert.equal(result.processedCandles,5);assert.equal(result.equitySnapshots.length,5);assert.equal(result.account.equity,10000);
});
