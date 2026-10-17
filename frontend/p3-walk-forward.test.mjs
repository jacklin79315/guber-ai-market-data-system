import test from 'node:test';import assert from 'node:assert/strict';import {evaluateWalkForward} from './p3-walk-forward.mjs';
const cohort='TREND_UP|LONG|1h';
const rows=Array.from({length:45},(_,i)=>({id:'t'+i,decisionTime:1000+i*100,closedTime:1050+i*100,outcome:i%4===0?'LOSS':'WIN',cohort}));
test('walk-forward only predicts after enough previously closed samples',()=>{const r=evaluateWalkForward(rows,{minSamples:30});assert.equal(r.total,45);assert.equal(r.evaluated,15);assert.equal(r.skipped,30);assert.ok(r.brierScore>=0&&r.brierScore<=1);assert.ok(r.predictions.every(p=>p.trainingSamples>=30))});
test('future close cannot leak into prediction history',()=>{const delayed=rows.map((r,i)=>i<30?{...r,closedTime:100000+i}:r);const result=evaluateWalkForward(delayed,{minSamples:30});assert.equal(result.evaluated,0);assert.equal(result.brierScore,null)});
test('no samples produces explicit insufficient data',()=>{const r=evaluateWalkForward([]);assert.equal(r.status,'INSUFFICIENT_DATA');assert.equal(r.evaluated,0)});
test('duplicate identifiers are rejected',()=>{assert.throws(()=>evaluateWalkForward([rows[0],rows[0]]),/walk-forward sample/)});
