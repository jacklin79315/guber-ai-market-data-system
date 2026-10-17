import test from 'node:test';import assert from 'node:assert/strict';import {detectEntryCandidate} from './p3-entry-baseline.mjs';
const make=(close,i)=>({symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*3600000-1,open:close,high:close+1,low:close-1,close});
test('closed candle above prior range produces LONG candidate',()=>{const bars=Array.from({length:20},(_,i)=>make(100,i));bars.push(make(105,20));const r=detectEntryCandidate({candles:bars});assert.equal(r.action,'CANDIDATE');assert.equal(r.side,'LONG');assert.equal(r.decisionTime,bars[20].closeTime)});
test('closed candle below prior range produces SHORT candidate',()=>{const bars=Array.from({length:20},(_,i)=>make(100,i));bars.push(make(95,20));assert.equal(detectEntryCandidate({candles:bars}).side,'SHORT')});
test('range-bound market waits instead of fabricating a trade',()=>{const bars=Array.from({length:21},(_,i)=>make(100,i));assert.equal(detectEntryCandidate({candles:bars}).action,'WAIT')});
test('insufficient history waits',()=>{assert.equal(detectEntryCandidate({candles:[make(100,0)]}).reason,'INSUFFICIENT_CLOSED_CANDLES')});
test('invalid chronological data is rejected',()=>{const bars=Array.from({length:21},(_,i)=>make(100,i));bars[20].closeTime=bars[19].closeTime;assert.throws(()=>detectEntryCandidate({candles:bars}),/closed candle/)});
