import test from 'node:test';import assert from 'node:assert/strict';import {runP4ResearchThenOOS} from './p4-research-then-oos.mjs';
const candles=Array.from({length:150},(_,i)=>({symbol:'BTCUSDT',timeframe:'1h',closeTime:i+1}));
test('rejects OOS candle injection before research',async()=>assert.rejects(runP4ResearchThenOOS({candles,otherReplayOptions:{validationCandles:candles}}),/override/));
test('rejects insufficient chronological data before research',async()=>assert.rejects(runP4ResearchThenOOS({candles:candles.slice(0,10)}),/insufficient/));

test('rejects partition candle replacement before research',async()=>assert.rejects(runP4ResearchThenOOS({candles,partitionOptions:{candles:[]}}),/override/));

test('rejects research provider substitution before training',async()=>assert.rejects(runP4ResearchThenOOS({candles,otherReplayOptions:{featureAtDecision:async()=>({})}}),/override/));
test('rejects injected brain or account settings before training',async()=>assert.rejects(runP4ResearchThenOOS({candles,otherReplayOptions:{brain:async()=>({action:'APPROVE'})}}),/override/));
