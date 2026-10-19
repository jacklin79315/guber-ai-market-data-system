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
