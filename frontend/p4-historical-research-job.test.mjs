import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4HistoricalResearchJob} from './p4-historical-research-job.mjs';
const hour=3600000;
const base={supabaseUrl:'https://example.supabase.co',apiKey:'public-test',symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:0,toOpenTime:hour,asOfMs:3*hour,championVersion:'champion',iterations:1,seed:1,costs:{feeRate:0.001,slippageRate:0.0005},brain:async()=>({action:'WAIT',reason:'research'})};
test('P4 historical job stops before reading or training when requested',async()=>{const r=await runP4HistoricalResearchJob({...base,shouldStop:()=>true,fetchImpl:async()=>{throw Error('must not read')}});assert.equal(r.status,'STOPPED_BEFORE_TRAINING');assert.equal(r.completedIterations,0)});
test('P4 historical job rejects caller-supplied fabricated feature snapshots',async()=>{await assert.rejects(runP4HistoricalResearchJob({...base,featureAtDecision:async()=>({})}),/database features/)});
