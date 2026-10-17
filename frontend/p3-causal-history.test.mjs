import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCausalExpertHistory,attachClosedTimes} from './p3-causal-history.mjs';
const trade={id:'x',symbol:'BTCUSDT',timeframe:'1h',side:'LONG',exitIndex:1,pnl:5};
const candles=[{symbol:'BTCUSDT',timeframe:'1h',closeTime:10},{symbol:'BTCUSDT',timeframe:'1h',closeTime:20}];
const archive=new Map([['x',{decisionTime:10,features:{asOfMs:10,rsi:50}}]]);
test('closed trade is eligible only after its closing timestamp',()=>{const closed=attachClosedTimes({closed:[trade],candles});assert.equal(buildCausalExpertHistory({closed,decisionArchive:archive,asOfMs:20}).tradeHistory.length,0);const result=buildCausalExpertHistory({closed,decisionArchive:archive,asOfMs:21});assert.equal(result.tradeHistory.length,1);assert.equal(result.tradeHistory[0].outcome,'WIN')});
test('future-derived archived features fail closed',()=>{const wrong=new Map([['x',{decisionTime:10,features:{asOfMs:11}}]]);assert.throws(()=>buildCausalExpertHistory({closed:attachClosedTimes({closed:[trade],candles}),decisionArchive:wrong,asOfMs:21}),/causal/)});
test('P2 exit index must match original market series',()=>assert.throws(()=>attachClosedTimes({closed:[{...trade,symbol:'ETHUSDT'}],candles}),/mismatch/));
