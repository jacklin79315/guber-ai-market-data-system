import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4ResearchCycle} from './p4-research-cycle.mjs';
import {DEFAULT_TRAINING_PARAMETERS as parameters} from './p4-challenger-parameters.mjs';
const candles=Array.from({length:25},(_,i)=>({symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*3600000-1,open:100,high:101,low:99,close:100}));
const base={championVersion:'champion-v1',championParameters:parameters,iterations:3,seed:7,candles,costs:{feeRate:0.001,slippageRate:0.0005},featureAtDecision:async({candidate})=>({asOfMs:candidate.decisionTime,rsi:55,atrPercent:0.02,volumeRatio:1.2,trendStrength:0.4,momentum:0.03}),brain:async()=>({action:'WAIT',reason:'research'})};
test('research ledger survives restart',async()=>{let stop=false;const first=await runP4ResearchCycle({...base,shouldStop:()=>stop,onIteration:()=>{stop=true}});const second=await runP4ResearchCycle({...base,resumeRounds:first.iterations});assert.equal(second.ledger.runs.length,3);assert.equal(second.ledgerHistoryComplete,true)});
test('legacy rounds have incomplete ledger history',async()=>{let stop=false;const first=await runP4ResearchCycle({...base,shouldStop:()=>stop,onIteration:()=>{stop=true}});const old=first.iterations.map(x=>({...x,ledgerSnapshot:undefined}));const second=await runP4ResearchCycle({...base,resumeRounds:old});assert.equal(second.ledgerHistoryComplete,false)});
