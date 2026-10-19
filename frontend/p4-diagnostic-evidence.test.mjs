import test from 'node:test';import assert from 'node:assert/strict';import {collectP4DiagnosticEvidence} from './p4-diagnostic-evidence.mjs';
test('closed trade preserves causal decision and costs without assuming loss is fault',()=>{const rows=collectP4DiagnosticEvidence({decisions:[{id:'t1',decisionTime:1,action:'APPROVE',history:[{expert:'Entry',action:'PASS'}]}],account:{closed:[{id:'t1',entryPrice:100,exitPrice:95,exitReason:'SL',pnl:-5,totalFees:1}],shadowOrders:[]}});assert.equal(rows.length,1);assert.equal(rows[0].evidence.netPnl,-5);assert.deepEqual(rows[0].feedback.feedback,[]);assert.equal(rows[0].diagnosis.requiresReview,true)});
test('WAIT and shadow preserve evidence but do not fabricate responsibility',()=>{const rows=collectP4DiagnosticEvidence({decisions:[{id:'w',action:'WAIT',decisionTime:1},{id:'s',action:'APPROVE',decisionTime:2}],account:{closed:[],shadowOrders:[{proposal:{id:'s'},reason:'PRE_ENTRY_TP',observations:[]}]}});assert.deepEqual(rows.map(x=>x.diagnosis.outcome),['SHADOW','WAIT']);assert(rows.every(x=>x.feedback.appliedToModels===false))});
test('reject closed trade without original decision evidence',()=>assert.throws(()=>collectP4DiagnosticEvidence({decisions:[],account:{closed:[{id:'orphan'}],shadowOrders:[]}})));

test('CLOSED replay candle exit index supplies verifiable close time and binary outcome',()=>{
 const rows=collectP4DiagnosticEvidence({decisions:[{id:'t2',decisionTime:100,action:'APPROVE',proposalAtDecision:{winProbability:0.55}}],account:{closed:[{id:'t2',symbol:'BTCUSDT',timeframe:'1h',exitIndex:1,entryPrice:100,exitPrice:105,exitReason:'TP',pnl:4,totalFees:1}],shadowOrders:[]},candles:[{symbol:'BTCUSDT',timeframe:'1h',closeTime:200},{symbol:'BTCUSDT',timeframe:'1h',closeTime:300}]});
 assert.equal(rows[0].evidence.closedAt,300);
 assert.equal(rows[0].evidence.realizedWin,true);
 assert.equal(rows[0].evidence.decisionTime,100);
 assert.equal(rows[0].feedback.appliedToModels,false);
});
test('CLOSED replay rejects exit index not backed by candle series',()=>{
 assert.throws(()=>collectP4DiagnosticEvidence({decisions:[{id:'t3',decisionTime:100,action:'APPROVE'}],account:{closed:[{id:'t3',symbol:'BTCUSDT',timeframe:'1h',exitIndex:3,pnl:2}],shadowOrders:[]},candles:[{symbol:'BTCUSDT',timeframe:'1h',closeTime:200}]}),/invalid P2 exit index/);
});
