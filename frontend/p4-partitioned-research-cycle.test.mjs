import test from 'node:test';import assert from 'node:assert/strict';import {runP4PartitionedResearchCycle} from './p4-partitioned-research-cycle.mjs';
test('partitioned runner rejects invalid or too-short chronology before any research',async()=>{await assert.rejects(runP4PartitionedResearchCycle({candles:[{closeTime:1,symbol:'BTCUSDT',timeframe:'1h'}]}),/insufficient/);await assert.rejects(runP4PartitionedResearchCycle({candles:[{closeTime:2,symbol:'BTCUSDT',timeframe:'1h'},{closeTime:1,symbol:'BTCUSDT',timeframe:'1h'}]}),/chronological/)});
test('rejects alternate candle injection through replay options',async()=>{const candles=Array.from({length:150},(_,i)=>({symbol:'BTCUSDT',timeframe:'1h',closeTime:i+1}));await assert.rejects(runP4PartitionedResearchCycle({candles,otherReplayOptions:{candles}}),/override partitioned/)});

test('partitioned OOS stays unavailable when research stops before a frozen candidate exists',async()=>{
 const candles=Array.from({length:150},(_,i)=>({symbol:'BTCUSDT',timeframe:'1h',closeTime:i+1}));
 const result=await runP4PartitionedResearchCycle({candles,championVersion:'baseline',championParameters:{entryLookback:20,entryThreshold:0.001,rewardAtrPeriod:14,rewardStopAtr:1.5,rewardTakeAtr:3},iterations:1,seed:1,shouldStop:()=>true});
 assert.equal(result.validationStatus,'RESERVED_NOT_EVALUATED');
 assert.equal(result.independentValidation,false);
 assert.equal(result.promotionAllowed,false);
 assert.equal(result.partition.researchCount,120);
 assert.equal(result.partition.validationCount,30);
});

test('completed research evaluates frozen parameters on untouched later candles without promotion',async()=>{
 const hour=3600000;
 const candles=Array.from({length:160},(_,i)=>({symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*hour-1,open:100+i*0.1,high:101+i*0.1,low:99+i*0.1,close:100+i*0.1}));
 const parameters={entryLookback:20,entryThreshold:0.001,rewardAtrPeriod:14,rewardStopAtr:1.5,rewardTakeAtr:3};
 const result=await runP4PartitionedResearchCycle({candles,championVersion:'champion',championParameters:parameters,iterations:1,seed:1,featureAtDecision:async({candidate})=>({asOfMs:candidate.decisionTime,rsi:55,atrPercent:0.02,volumeRatio:1.2,trendStrength:0.4,momentum:0.03}),brain:async()=>({action:'WAIT',reason:'holdout test'}),costs:{feeRate:0.001,slippageRate:0.001}});
 assert.equal(result.status,'RESEARCH_CYCLE_COMPLETED');
 assert.equal(result.partition.researchCount,128);
 assert.equal(result.partition.validationCount,32);
 assert.equal(result.partition.boundary.researchEndMs<candles[128].closeTime,true);
 assert.equal(result.independentValidation,true);
 assert.equal(result.validationStatus,'OOS_INSUFFICIENT_CLOSED_TRADES');
 assert.equal(result.oosEvaluation.processedCandles,32);
 assert.equal(result.oosEvaluation.selectedBeforeOos,true);
 assert.equal(result.oosEvaluation.improvedNetPnl,null);
 assert.equal(result.promotionAllowed,false);
});

test('OOS selection belongs to the completed research prefix',async()=>{
 const hour=3600000;
 const candles=Array.from({length:160},(_,i)=>({symbol:'BTCUSDT',timeframe:'1h',closeTime:(i+1)*hour-1,open:100+i*.1,high:101+i*.1,low:99+i*.1,close:100+i*.1}));
 const params={entryLookback:20,entryThreshold:.001,rewardAtrPeriod:14,rewardStopAtr:1.5,rewardTakeAtr:3};
 const result=await runP4PartitionedResearchCycle({candles,championVersion:'champion',championParameters:params,iterations:1,seed:1,featureAtDecision:async({candidate})=>({asOfMs:candidate.decisionTime,rsi:55,atrPercent:.02,volumeRatio:1.2,trendStrength:.4,momentum:.03}),brain:async()=>({action:'WAIT',reason:'holdout test'}),costs:{feeRate:0.001,slippageRate:0.001}});
 assert.equal(result.oosEvaluation.selectedBeforeOos,true);
 assert.ok(result.oosEvaluation.selectedVersion==='champion'||result.iterations.some(x=>x.challengerVersion===result.oosEvaluation.selectedVersion));
});
