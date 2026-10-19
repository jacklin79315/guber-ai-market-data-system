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

import {createP4ArtifactChunkStore} from './p4-supabase-artifact-chunks.mjs';
import {extractP4ClosedWinObservations} from './p4-win-evidence-adapter.mjs';
test('P4 CLOSED evidence survives immutable chunk write/read before calibration eligibility',async()=>{
 const bars=Array.from({length:90},(_,i)=>{const c=i<20?100:105+i-20;return {symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*3600000-1,open:c,high:c+1,low:c-1,close:c}});
 const result=await compareChallengerReplay({...options,candles:bars,brain:async()=>({action:'APPROVE',reason:'persisted causal evidence fixture'}),challenger:{version:'challenger-v2',parameters:{...defaults,entryLookback:6}}});
 const chunks=new Map();
 const fetchImpl=async(url,opts)=>{
  const u=new URL(url),kind=u.searchParams.get('artifact_kind')?.replace('eq.','');
  if(opts.method==='POST'){
   const p=JSON.parse(opts.body),key=p.p_artifact_kind+':'+p.p_chunk_index;
   chunks.set(key,{chunk_index:p.p_chunk_index,payload:p.p_payload,payload_sha256:p.p_payload_sha256});
   return {ok:true,json:async()=>true};
  }
  const offset=Number(u.searchParams.get('offset')??0),limit=Number(u.searchParams.get('limit')??1000);
  return {ok:true,json:async()=>[...chunks.entries()].filter(([k])=>k.startsWith(kind+':')).map(([,v])=>v).sort((a,b)=>a.chunk_index-b.chunk_index).slice(offset,offset+limit)};
 };
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl});
 for(const side of ['champion','challenger']){
  const kind=side.toUpperCase()+'_DIAGNOSTICS',records=result.diagnosticEvidence[side];
  const manifest=await store.write({jobId:'p4-causal-fixture',ownerToken:'test-owner-token-12345',specFingerprint:'a'.repeat(64),iteration:1,kind,records,maxChunkBytes:4096});
  const restored=await store.read({jobId:'p4-causal-fixture',iteration:1,kind,manifest});
  assert.deepEqual(restored,records);
  const settled=restored.filter(x=>x.diagnosis.outcome==='CLOSED');
  assert.ok(settled.length>0);
  assert.ok(settled.every(x=>Number.isSafeInteger(x.evidence.closedAt)&&typeof x.evidence.realizedWin==='boolean'));
  const observations=extractP4ClosedWinObservations({records:restored});
  assert.equal(observations.modelUpdateApplied,false);
  assert.equal(observations.championPromotionAllowed,false);
  assert.equal(observations.totalRecords,records.length);
 }
});
