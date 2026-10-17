import {loadP4SegmentedHistoricalCandles} from './p4-segmented-reader.mjs';
import {createSupabaseFeatureAtDecision} from './p3-supabase-feature-reader.mjs';
import {runP4ResearchCycle} from './p4-research-cycle.mjs';
// Offline P4 orchestration. Data must be fully verified before any research iteration.
// This is not a trained Brain, independent OOS evaluation, or a live trading endpoint.
export async function runP4HistoricalResearchJob({supabaseUrl,apiKey,fetchImpl=fetch,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandlesPerWindow=10000,brain,historyAtDecision,featureAtDecision,shouldStop=()=>false,onProgress,championVersion,championParameters,iterations,seed,costs,accountOptions={},otherReplayOptions={}}={}){
 if(typeof brain!=='function'||featureAtDecision!==undefined||typeof shouldStop!=='function'||(onProgress!==undefined&&typeof onProgress!=='function'))throw Error('P4 historical job requires explicit Brain and database features');
 const loaded=await loadP4SegmentedHistoricalCandles({supabaseUrl,apiKey,fetchImpl,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandlesPerWindow,shouldStop,onProgress:p=>onProgress?.({phase:'LOADING',...p})});
 if(!loaded.verified)return {status:'STOPPED_BEFORE_TRAINING',source:'SUPABASE_READ_ONLY',loadedCandles:loaded.loadedCandles,completedIterations:0};
 if(shouldStop())return {status:'STOPPED_BEFORE_TRAINING',source:'SUPABASE_READ_ONLY',loadedCandles:loaded.loadedCandles,completedIterations:0};
 const featureReader=createSupabaseFeatureAtDecision({supabaseUrl,apiKey,fetchImpl});
 const research=await runP4ResearchCycle({championVersion,championParameters,iterations,seed,candles:loaded.candles,featureAtDecision:featureReader,historyAtDecision,brain,costs,accountOptions,otherReplayOptions,shouldStop,onIteration:x=>onProgress?.({phase:'RESEARCH',iteration:x.iteration,totalIterations:iterations,feedback:x.feedback})});
 return {...research,source:'SUPABASE_READ_ONLY',dataVerified:true,loadedCandles:loaded.loadedCandles,windowCount:loaded.plan.windowCount};
}
