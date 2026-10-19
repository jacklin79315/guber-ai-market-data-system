import test from 'node:test';
import assert from 'node:assert/strict';
import {compareChallengerReplay} from './p4-challenger-comparison.mjs';
import {DEFAULT_TRAINING_PARAMETERS as defaults} from './p4-challenger-parameters.mjs';
const candles=Array.from({length:25},(_,i)=>{const c=i<20?100:105+i-20;return {symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*3600000-1,open:c,high:c+1,low:c-1,close:c}});
const options={candles,featureAtDecision:async({candidate})=>({asOfMs:candidate.decisionTime,rsi:55,atrPercent:0.02,volumeRatio:1.2,trendStrength:0.4,momentum:0.03}),brain:async()=>({action:'WAIT',reason:'research'}),costs:{feeRate:0.001,slippageRate:0.001},champion:{version:'champion-v1',parameters:defaults},challenger:{version:'challenger-v2',parameters:{...defaults,entryLookback:40}}};
test('comparison uses same candles and separate candidate counts',async()=>{const r=await compareChallengerReplay(options);assert.equal(r.champion.processedCandles,25);assert.equal(r.challenger.processedCandles,25);assert.ok(r.champion.statistics.candidateCount>0);assert.equal(r.challenger.statistics.candidateCount,0)});
test('same-window results never authorize model promotion',async()=>{const r=await compareChallengerReplay(options);assert.equal(r.independentValidation,false);assert.equal(r.promotionAllowed,false);assert.equal(r.status,'RESEARCH_COMPARISON_ONLY')});
test('invalid candidate parameters are refused',async()=>{await assert.rejects(compareChallengerReplay({...options,challenger:{...options.challenger,parameters:{...defaults,entryLookback:300}}}),/invalid parameter/)});
test('identical version IDs are refused',async()=>{await assert.rejects(compareChallengerReplay({...options,challenger:{...options.challenger,version:'champion-v1'}}),/invalid challenger comparison/)});

test('P4 comparison preserves causal CLOSED evidence for both arms without model promotion',async()=>{
 const approved=async()=>({action:'APPROVE',reason:'causal evidence integration fixture'});
 const more=Array.from({length:90},(_,i)=>{const c=i<20?100:105+i-20;return {symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*3600000-1,open:c,high:c+1,low:c-1,close:c}});
 const r=await compareChallengerReplay({...options,candles:more,brain:approved,challenger:{version:'challenger-v2',parameters:{...defaults,entryLookback:6}}});
 assert.equal(r.promotionAllowed,false);
 for(const side of ['champion','challenger']){
  const closed=r.diagnosticEvidence[side].filter(x=>x.diagnosis.outcome==='CLOSED');
  assert.ok(closed.length>0,side+' must produce at least one settled trade in fixture');
  for(const event of closed){
   assert.ok(Number.isSafeInteger(event.evidence.closedAt));
   assert.ok(event.evidence.closedAt>event.evidence.decisionTime);
   assert.equal(typeof event.evidence.realizedWin,'boolean');
   assert.ok(more.some(bar=>bar.closeTime===event.evidence.closedAt));
   assert.equal(event.feedback.appliedToModels,false);
  }
 }
});
