// Read-only fixed-candidate retrospective replay. Does not select or promote parameters.
import {loadP4SegmentedHistoricalCandles} from './p4-segmented-reader.mjs';
import {createSupabaseFeatureAtDecision} from './p3-supabase-feature-reader.mjs';
import {evaluateP4LockedEntryCandidate} from './p4-diagnostic-locked-candidate.mjs';
import {researchRuleBrain} from './p3-research-rule-brain.mjs';
export async function runP4LockedBackend({confirm,supabaseUrl,serviceRoleKey,fetchImpl=fetch,fromOpenTime,toOpenTime,asOfMs,brain=researchRuleBrain,costs={feeRate:0.001,slippageRate:0}}={}){
 const step=3600000;
 if(confirm!=='RESEARCH_ONLY'||![fromOpenTime,toOpenTime,asOfMs].every(Number.isSafeInteger)||fromOpenTime<0||fromOpenTime%step!==0||toOpenTime%step!==0||toOpenTime<fromOpenTime+129*step||toOpenTime>fromOpenTime+1999*step||asOfMs<=toOpenTime+step-1)throw Error('invalid research-only fixed candidate bounds');
 const loaded=await loadP4SegmentedHistoricalCandles({supabaseUrl,apiKey:serviceRoleKey,fetchImpl,symbol:'BTCUSDT',timeframe:'1h',fromOpenTime,toOpenTime,asOfMs});
 if(!loaded.verified)throw Error('locked candidate source not verified');
 const reader=createSupabaseFeatureAtDecision({supabaseUrl,apiKey:serviceRoleKey,fetchImpl});
 await reader.prefetch({symbol:'BTCUSDT',timeframe:'1h',fromCloseTime:loaded.candles[0].closeTime,toCloseTime:loaded.candles.at(-1).closeTime});
 const evaluation=await evaluateP4LockedEntryCandidate({confirm,candles:loaded.candles,featureAtDecision:reader,brain,costs});
 return {...evaluation,loadedCandles:loaded.loadedCandles,source:'VERIFIED_SUPABASE_HISTORY',independentValidation:false,ordersEnabled:false,championPromotionAllowed:false};
}
