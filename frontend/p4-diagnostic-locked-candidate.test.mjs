import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateP4LockedEntryCandidate} from './p4-diagnostic-locked-candidate.mjs';
test('locked candidate uses only fixed lookback and never promotes',async()=>{
 const candles=Array.from({length:130},(_,i)=>({closeTime:(i+1)*3600000}));
 const r=await evaluateP4LockedEntryCandidate({confirm:'RESEARCH_ONLY',candles,brain:()=>({}),replay:async({arm})=>{
  assert.equal(arm.from,20);assert.equal(arm.to,17);
  return {feedback:{status:'RESEARCH_EVIDENCE_ONLY'},comparison:{}};
 }});
 assert.equal(r.independentValidation,false);
 assert.equal(r.ordersEnabled,false);
 assert.equal(r.championPromotionAllowed,false);
});
