import test from 'node:test';
import assert from 'node:assert/strict';
import {parseP4RunnerOptions} from './p4-backend-runner.mjs';
const valid={P4_RESEARCH_CONFIRM:'RESEARCH_ONLY',P4_JOB_ID:'smoke_test',P4_SYMBOL:'BTCUSDT',P4_TIMEFRAME:'1h',P4_FROM_MS:'0',P4_TO_MS:String(24*3600000),P4_AS_OF_MS:String(26*3600000),P4_ITERATIONS:'1'};
test('P4 backend runner requires explicit opt-in',()=>{assert.throws(()=>parseP4RunnerOptions({...valid,P4_RESEARCH_CONFIRM:''}),/disabled/);assert.equal(parseP4RunnerOptions(valid).expectedCandles,25)});
test('P4 backend runner refuses large or unsafe research',()=>{assert.throws(()=>parseP4RunnerOptions({...valid,P4_ITERATIONS:'100'}),/bounded/);assert.throws(()=>parseP4RunnerOptions({...valid,P4_TO_MS:String(600*3600000),P4_AS_OF_MS:String(602*3600000)}),/500 candles/);assert.throws(()=>parseP4RunnerOptions({...valid,P4_JOB_ID:'bad;id'}),/P4_JOB_ID/);});
