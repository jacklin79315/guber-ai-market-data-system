import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4SupabaseResearchCycle} from './p4-supabase-research.mjs';
const base={supabaseUrl:'https://example.supabase.co',apiKey:'test',symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:0,toOpenTime:3600000,asOfMs:10800000,championVersion:'baseline',iterations:1,seed:1,brain:async()=>({action:'WAIT',reason:'research'}),costs:{feeRate:0.001,slippageRate:0.0005}};
test('P4 refuses silent truncation of large historical requests',async()=>{await assert.rejects(runP4SupabaseResearchCycle({...base,toOpenTime:10000*3600000}),/explicit bound/)});
test('P4 rejects unclosed or misaligned candle ranges',async()=>{await assert.rejects(runP4SupabaseResearchCycle({...base,toOpenTime:7200000,asOfMs:9000000}),/invalid P4 historical interval/);await assert.rejects(runP4SupabaseResearchCycle({...base,fromOpenTime:1}),/invalid P4 historical interval/)});
test('P4 rejects fabricated feature providers before research begins',async()=>{await assert.rejects(runP4SupabaseResearchCycle({...base,fetchImpl:async()=>({ok:true,json:async()=>[]}),featureAtDecision:async()=>({})}),/P4 historical candles missing|P4 feature override/)});
