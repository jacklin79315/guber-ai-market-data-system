import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4ResearchCycle} from './p4-research-cycle.mjs';
import {DEFAULT_TRAINING_PARAMETERS as defaults} from './p4-challenger-parameters.mjs';
const candles=Array.from({length:25},(_,i)=>{const c=i<20?100:105+i-20;return {symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*3600000-1,open:c,high:c+1,low:c-1,close:c}});
const base={championVersion:'champion-v1',championParameters:defaults,iterations:3,seed:7,candles,costs:{feeRate:0.001,slippageRate:0.0005},featureAtDecision:async({candidate})=>({asOfMs:candidate.decisionTime,rsi:55,atrPercent:0.02,volumeRatio:1.2,trendStrength:0.4,momentum:0.03}),brain:async()=>({action:'WAIT',reason:'research'})};
test('multi-round P4 research preserves Champion and stores every candidate',async()=>{const r=await runP4ResearchCycle(base);assert.equal(r.completedIterations,3);assert.equal(r.ledger.runs.length,3);assert.equal(r.championVersion,'champion-v1');assert.equal(r.researchParentVersion,'champion-v1');assert.equal(r.promotionAllowed,false);assert.ok(r.iterations.every(x=>x.feedback.status==='INSUFFICIENT_RESEARCH_SAMPLES'))});
test('P4 cycle can stop between rounds without changing Champion',async()=>{let count=0;const r=await runP4ResearchCycle({...base,shouldStop:()=>count>=1,onIteration:()=>{count++}});assert.equal(r.status,'RESEARCH_CYCLE_STOPPED');assert.equal(r.completedIterations,1);assert.equal(r.championVersion,'champion-v1')});
test('P4 cycle rejects unbounded or invalid iterations',async()=>{await assert.rejects(runP4ResearchCycle({...base,iterations:101}),/invalid P4 research cycle/);await assert.rejects(runP4ResearchCycle({...base,iterations:0}),/invalid P4 research cycle/)});

test('prior Entry diagnosis focuses the next research mutation and records the reason',async()=>{
 let rounds=0;
 const result=await runP4ResearchCycle({...base,iterations:2,onIteration:round=>{
  rounds++;
  if(rounds===1){const comparison=round.ledgerSnapshot.runs.at(-1).result.comparison;
   comparison.diagnosticAudit.challenger.actors.Entry.negative=3;
   comparison.diagnosticAudit.challenger.actors.Reward.negative=0;
  }
 }});
 assert.equal(result.iterations[0].preferredActor,null);
 assert.equal(result.iterations[1].preferredActor,'Entry');
 assert.ok(result.iterations[1].candidate.mutatedParameter.startsWith('entry'));
 assert.equal(result.promotionAllowed,false);
});
