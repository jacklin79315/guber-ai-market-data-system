import test from 'node:test';
import assert from 'node:assert/strict';
import {collectP4DiagnosticEvidence} from './p4-diagnostic-evidence.mjs';
test('causal close time and explicit outcome from original candle index',()=>{
 const replay={decisions:[{id:'trade1',decisionTime:100,action:'APPROVE'}],candles:[{symbol:'BTCUSDT',timeframe:'1h',closeTime:100},{symbol:'BTCUSDT',timeframe:'1h',closeTime:200}],account:{closed:[{id:'trade1',symbol:'BTCUSDT',timeframe:'1h',exitIndex:1,pnl:5}],shadowOrders:[]}};
 const result=collectP4DiagnosticEvidence(replay);
 assert.equal(result[0].evidence.closedAt,200);
 assert.equal(result[0].evidence.realizedWin,true);
 const missing=collectP4DiagnosticEvidence({...replay,candles:undefined});
 assert.equal(missing[0].evidence.closedAt,null);
});
test('break even cannot be silently labeled a win or loss',()=>{
 const replay={decisions:[{id:'trade1',decisionTime:100,action:'APPROVE'}],account:{closed:[{id:'trade1',pnl:0}],shadowOrders:[]}};
 assert.equal(collectP4DiagnosticEvidence(replay)[0].evidence.realizedWin,null);
});

test('rejects a trade closing at or before its archived decision',()=>{
 const replay={decisions:[{id:'trade1',decisionTime:200,action:'APPROVE'}],candles:[{symbol:'BTCUSDT',timeframe:'1h',closeTime:100},{symbol:'BTCUSDT',timeframe:'1h',closeTime:200}],account:{closed:[{id:'trade1',symbol:'BTCUSDT',timeframe:'1h',exitIndex:1,pnl:5}],shadowOrders:[]}};
 assert.throws(()=>collectP4DiagnosticEvidence(replay),/invalid causal closed timestamp/);
});
