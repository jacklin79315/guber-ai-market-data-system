import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4HistoricalResearchJob} from './p4-historical-research-job.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
const hour=3600000;
const raw=Array.from({length:25},(_,i)=>({source:'BINANCE',market:'SPOT',symbol:'BTCUSDT',timeframe:'1h',open_time:i*hour,close_time:(i+1)*hour-1,open_price:'100',high_price:'101',low_price:'99',close_price:'100'}));
const fetchImpl=async url=>{const u=new URL(url);if(u.pathname.endsWith('/raw_candles')){const after=Number(u.searchParams.get('open_time').slice(3));const end=Number(u.searchParams.get('and').match(/lte\.(\d+)/)[1]);return {ok:true,json:async()=>raw.filter(x=>x.open_time>after&&x.open_time<=end)}}if(u.pathname.endsWith('/market_features'))return {ok:true,json:async()=>[{source:'BINANCE',market:'SPOT',symbol:'BTCUSDT',timeframe:'1h',open_time:0,close_time:hour-1,rsi_12:55,atr_percent:0.02,volume_ratio:1.2,adx_14:0.4,return_3:0.03}]};throw Error('unexpected request')};
test('P4 stop after resumed data reload preserves committed round count',async()=>{
 let checkpoint=null,active=false,stop=false;const rounds=[];
 const checkpointStore={load:async()=>structuredClone(checkpoint),save:async()=>{throw Error('unfenced checkpoint')},saveLeased:async x=>{checkpoint=structuredClone(x)}};
 const roundStore={load:async()=>structuredClone(rounds),commit:async()=>{throw Error('unfenced round')},commitLeased:async(_j,_o,_f,r)=>{rounds.push(structuredClone(r))}};
 const leaseStore={claim:async()=>{if(active)return false;active=true;return true},renew:async()=>active,release:async()=>{active=false;return true}};
 const base={supabaseUrl:'https://example.supabase.co',apiKey:'test',fetchImpl,symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:0,toOpenTime:24*hour,asOfMs:26*hour,brain:async()=>({action:'WAIT',reason:'research'}),championVersion:'champion-v1',championParameters:DEFAULT_TRAINING_PARAMETERS,iterations:3,seed:7,codeRevision:'test-revision',costs:{feeRate:0.001,slippageRate:0.0005},checkpointStore,roundStore,leaseStore,ownerToken:'o'.repeat(32),jobId:'resume-stop-test',shouldStop:()=>stop,onProgress:p=>{if(p.phase==='RESEARCH'&&p.iteration===1)stop=true}};
 const first=await runP4HistoricalResearchJob(base);assert.equal(first.completedIterations,1);assert.equal(rounds.length,1);
 stop=false;
 const second=await runP4HistoricalResearchJob({...base,onProgress:p=>{if(p.phase==='LOADING')stop=true}});
 assert.equal(second.status,'STOPPED_BEFORE_TRAINING');assert.equal(second.completedIterations,1);assert.equal(checkpoint.completedIterations,1);assert.equal(rounds.length,1);assert.equal(active,false);
});
