import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4HistoricalResearchJob} from './p4-historical-research-job.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
const hour=3600000;
const raw=Array.from({length:25},(_,i)=>{const c=i<20?100:105+i-20;return {source:'BINANCE',market:'SPOT',symbol:'BTCUSDT',timeframe:'1h',open_time:i*hour,close_time:(i+1)*hour-1,open_price:String(c),high_price:String(c+1),low_price:String(c-1),close_price:String(c)}});
const fetchImpl=async(url)=>{const u=new URL(url);if(u.pathname.endsWith('/raw_candles')){const after=Number(u.searchParams.get('open_time').slice(3));const end=Number(u.searchParams.get('and').match(/lte\.(\d+)/)[1]);return {ok:true,json:async()=>raw.filter(x=>x.open_time>after&&x.open_time<=end)}}if(u.pathname.endsWith('/market_features')){const close=Number(u.searchParams.get('close_time').slice(3));return {ok:true,json:async()=>[{source:'BINANCE',market:'SPOT',symbol:'BTCUSDT',timeframe:'1h',open_time:close-hour+1,close_time:close,rsi_12:55,atr_percent:0.02,volume_ratio:1.2,adx_14:0.4,return_3:0.03}]}}throw Error('unexpected read '+u.pathname)};
test('P4 durable job stops after round one, restarts, and completes without duplicate round',async()=>{
 let checkpoint=null,active=false,stop=false;const rounds=[];
 const checkpointStore={load:async()=>structuredClone(checkpoint),save:async x=>{checkpoint=structuredClone(x)},saveLeased:async(x,owner)=>{assert.ok(active);assert.equal(owner,'o'.repeat(32));checkpoint=structuredClone(x)}};
 const roundStore={load:async()=>structuredClone(rounds),commit:async()=>{throw Error('unfenced write forbidden')},commitLeased:async(_job,owner,_fp,round)=>{assert.ok(active);assert.equal(owner,'o'.repeat(32));assert.equal(round.iteration,rounds.length+1);rounds.push(structuredClone(round))}};
 const leaseStore={claim:async()=>{if(active)return false;active=true;return true},renew:async()=>active,release:async()=>{active=false;return true}};
 const base={supabaseUrl:'https://example.supabase.co',apiKey:'anon-test',fetchImpl,symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:0,toOpenTime:24*hour,asOfMs:26*hour,brain:async()=>({action:'WAIT',reason:'research'}),championVersion:'champion-v1',championParameters:DEFAULT_TRAINING_PARAMETERS,iterations:3,seed:7,codeRevision:'test-revision',costs:{feeRate:0.001,slippageRate:0.0005},checkpointStore,roundStore,leaseStore,ownerToken:'o'.repeat(32),jobId:'integration-test',shouldStop:()=>stop,onProgress:p=>{if(p.phase==='RESEARCH'&&p.iteration===1)stop=true}};
 const first=await runP4HistoricalResearchJob(base);assert.equal(first.status,'RESEARCH_CYCLE_STOPPED');assert.equal(rounds.length,1);assert.equal(checkpoint.completedIterations,1);
 stop=false;const second=await runP4HistoricalResearchJob({...base,onProgress:undefined});assert.equal(second.status,'RESEARCH_CYCLE_COMPLETED');assert.equal(second.completedIterations,3);assert.deepEqual(rounds.map(x=>x.iteration),[1,2,3]);assert.equal(checkpoint.phase,'COMPLETED');assert.equal(active,false);
 await assert.rejects(runP4HistoricalResearchJob(base),/cannot safely resume/);
});
