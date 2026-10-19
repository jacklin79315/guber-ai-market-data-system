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

test('Reward diagnosis focuses the following round on Reward parameters',async()=>{
 let count=0;
 const result=await runP4ResearchCycle({...base,iterations:2,onIteration:round=>{
  count++;
  if(count===1){const actors=round.ledgerSnapshot.runs.at(-1).result.comparison.diagnosticAudit.challenger.actors;
   actors.Entry.negative=0;actors.Reward.negative=4;
  }
 }});
 assert.equal(result.iterations[1].preferredActor,'Reward');
 assert.ok(result.iterations[1].candidate.mutatedParameter.startsWith('reward'));
 assert.equal(result.promotionAllowed,false);
});

test('equal baseline and challenger Entry faults do not steer next mutation',async()=>{
 let count=0;
 const result=await runP4ResearchCycle({...base,iterations:2,onIteration:round=>{
  if(++count===1){const audit=round.ledgerSnapshot.runs.at(-1).result.comparison.diagnosticAudit;
   audit.champion.actors.Entry.negative=3;
   audit.challenger.actors.Entry.negative=3;
   audit.challenger.actors.Reward.negative=0;
  }
 }});
 assert.equal(result.iterations[1].preferredActor,null);
 assert.equal(result.promotionAllowed,false);
});

test('unguided control ignores diagnostic focus and keeps reproducible mutation',async()=>{
 const a=await runP4ResearchCycle({...base,iterations:2,explorationMode:'UNGUIDED',onIteration:round=>{
  if(round.iteration===1)round.ledgerSnapshot.runs.at(-1).result.comparison.diagnosticAudit.challenger.actors.Entry.negative=9;
 }});
 const b=await runP4ResearchCycle({...base,iterations:2,explorationMode:'UNGUIDED'});
 assert.equal(a.explorationMode,'UNGUIDED');
 assert.equal(a.iterations[1].preferredActor,null);
 assert.deepEqual(a.iterations.map(x=>x.candidate.parameters),b.iterations.map(x=>x.candidate.parameters));
 assert.equal(a.promotionAllowed,false);
});

test('guided cycle uses prior measured research feedback for a directed probe when expert diagnosis is unresolved',async()=>{
 const result=await runP4ResearchCycle({...base,iterations:2,onIteration:round=>{
  if(round.iteration===1){round.feedback.status='RESEARCH_EVIDENCE_ONLY';round.feedback.champion.closedTrades=30;round.feedback.challenger.closedTrades=30;}
 }});
 const first=result.iterations[0].candidate;
 const second=result.iterations[1];
 assert.equal(second.preferredActor,null);
 assert.equal(second.directedProbe?.parameter,first.mutatedParameter);
 assert.equal(second.directedProbe?.direction,first.to>first.from?-1:1);
 assert.equal(second.candidate.probeSource,'PRIOR_SAME_WINDOW_RESULT');
 assert.equal(result.promotionAllowed,false);
});

test('unguided mode never adopts a measured directional probe',async()=>{
 const result=await runP4ResearchCycle({...base,iterations:2,explorationMode:'UNGUIDED',onIteration:round=>{
  if(round.iteration===1){round.feedback.status='RESEARCH_EVIDENCE_ONLY';round.feedback.champion.closedTrades=30;round.feedback.challenger.closedTrades=30;}
 }});
 assert.equal(result.iterations[1].directedProbe,null);
 assert.equal(result.iterations[1].candidate.probeSource,undefined);
});

test('guided research does not learn a direction from fewer than 30 settled trades',async()=>{
 const result=await runP4ResearchCycle({...base,iterations:2,onIteration:round=>{
  if(round.iteration===1)round.feedback.status='RESEARCH_EVIDENCE_ONLY';
 }});
 assert.equal(result.iterations[1].directedProbe,null);
});

test('research cycle reports actual unique candidates rather than treating rounds as learning',async()=>{const result=await runP4ResearchCycle({...base,iterations:6});assert.equal(result.explorationSummary.totalRounds,6);assert.equal(result.explorationSummary.uniqueParameterSets,6);assert.equal(result.explorationSummary.duplicateParameterSets,0);assert.equal(result.explorationSummary.diagnosticActorDirectedRounds,0)});
