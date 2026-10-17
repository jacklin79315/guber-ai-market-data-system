import test from 'node:test';import assert from 'node:assert/strict';import {partitionP4ChronologicalCandles} from './p4-chronological-partition.mjs';
const candles=Array.from({length:150},(_,i)=>({symbol:'BTCUSDT',timeframe:'1h',closeTime:i+1}));
test('research precedes untouched validation with no overlap',()=>{const x=partitionP4ChronologicalCandles({candles});assert.equal(x.researchCount,120);assert.equal(x.validationCount,30);assert(x.boundary.researchEndMs<x.boundary.validationStartMs);assert.equal(x.promotionAllowed,false)});
test('reject duplicates, shuffled candles and mixed market',()=>{for(const bad of [[...candles.slice(0,149),candles[148]],[candles[1],candles[0],...candles.slice(2)],[...candles.slice(0,149),{...candles[149],symbol:'ETHUSDT'}]])assert.throws(()=>partitionP4ChronologicalCandles({candles:bad}))});
test('reject insufficient research or validation',()=>assert.throws(()=>partitionP4ChronologicalCandles({candles:candles.slice(0,80)})));
