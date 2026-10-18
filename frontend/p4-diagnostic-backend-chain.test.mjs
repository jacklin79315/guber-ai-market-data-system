import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4DiagnosticBackendChain} from './p4-diagnostic-backend-chain.mjs';
const hour=3600000;
const w=(start)=>({symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:start*hour,toOpenTime:(start+199)*hour,asOfMs:(start+201)*hour});
test('overlapping historical research evidence rejected before any writes',async()=>{
 let writes=0;
 await assert.rejects(()=>runP4DiagnosticBackendChain({grant:{maxRounds:2},windows:[w(1000),w(1100)],taskStore:{create:async()=>{writes++}},summaryStore:{load:async()=>null}}),/overlapping historical/);
 assert.equal(writes,0);
});
test('disjoint but invalid candle evidence rejected before any writes',async()=>{
 await assert.rejects(()=>runP4DiagnosticBackendChain({grant:{maxRounds:1},windows:[{...w(1000),asOfMs:1199*hour}]}),/invalid historical evidence/);
});
