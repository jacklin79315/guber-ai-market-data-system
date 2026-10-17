import {fingerprintP4JobSpec,assertP4CheckpointCompatible} from './p4-job-spec.mjs';
import {createP4Checkpoint} from './p4-checkpoints.mjs';
import {loadP4SegmentedHistoricalCandles} from './p4-segmented-reader.mjs';
import {createSupabaseFeatureAtDecision} from './p3-supabase-feature-reader.mjs';
import {runP4ResearchCycle} from './p4-research-cycle.mjs';
// Offline P4 orchestration. Data must be fully verified before any research iteration.
// This is not a trained Brain, independent OOS evaluation, or a live trading endpoint.
export async function runP4HistoricalResearchJob({supabaseUrl,apiKey,fetchImpl=fetch,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandlesPerWindow=10000,brain,historyAtDecision,featureAtDecision,shouldStop=()=>false,onProgress,checkpointStore,jobId,codeRevision,championVersion,championParameters,iterations,seed,costs,accountOptions={},otherReplayOptions={}}={}){
 if(typeof brain!=='function'||featureAtDecision!==undefined||typeof shouldStop!=='function'||(onProgress!==undefined&&typeof onProgress!=='function'))throw Error('P4 historical job requires explicit Brain and database features');
 if((checkpointStore&&!jobId)||(!checkpointStore&&jobId)||checkpointStore&&(typeof checkpointStore.save!=='function'||typeof checkpointStore.load!=='function'))throw Error('P4 checkpoint requires store and jobId');
 const specFingerprint=checkpointStore?fingerprintP4JobSpec({symbol,timeframe,fromOpenTime,toOpenTime,maxCandlesPerWindow,codeRevision,championVersion,championParameters,iterations,seed,accountOptions,otherReplayOptions,...(asOfMs===undefined?{}:{asOfMs}),...(costs===undefined?{}:{costs})}):undefined;
 if(checkpointStore){const previous=await checkpointStore.load(jobId);if(previous){assertP4CheckpointCompatible(previous,{jobId,specFingerprint});throw Error('P4 job already exists; safe resume not yet implemented; refusing overwrite');}}
 const saveProgress=async ({phase,completedWindows=0,loadedCandles=0,completedIterations=0})=>{if(checkpointStore)await checkpointStore.save(createP4Checkpoint({jobId,phase,completedWindows,loadedCandles,completedIterations,updatedAtMs:Date.now(),specFingerprint}));};
 await saveProgress({phase:'LOADING'});
 const loaded=await loadP4SegmentedHistoricalCandles({supabaseUrl,apiKey,fetchImpl,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandlesPerWindow,shouldStop,onProgress:async p=>{await saveProgress({phase:'LOADING',...p});await onProgress?.({phase:'LOADING',...p});}});
 if(!loaded.verified){await saveProgress({phase:'STOPPED',loadedCandles:loaded.loadedCandles,completedWindows:loaded.completedWindows});return {status:'STOPPED_BEFORE_TRAINING',source:'SUPABASE_READ_ONLY',loadedCandles:loaded.loadedCandles,completedIterations:0};}
 if(shouldStop()){await saveProgress({phase:'STOPPED',loadedCandles:loaded.loadedCandles,completedWindows:loaded.completedWindows});return {status:'STOPPED_BEFORE_TRAINING',source:'SUPABASE_READ_ONLY',loadedCandles:loaded.loadedCandles,completedIterations:0};}
 await saveProgress({phase:'RESEARCH',loadedCandles:loaded.loadedCandles,completedWindows:loaded.completedWindows});
 const featureReader=createSupabaseFeatureAtDecision({supabaseUrl,apiKey,fetchImpl});
 const research=await runP4ResearchCycle({championVersion,championParameters,iterations,seed,candles:loaded.candles,featureAtDecision:featureReader,historyAtDecision,brain,costs,accountOptions,otherReplayOptions,shouldStop,onIteration:async x=>{await saveProgress({phase:'RESEARCH',loadedCandles:loaded.loadedCandles,completedWindows:loaded.completedWindows,completedIterations:x.iteration});await onProgress?.({phase:'RESEARCH',iteration:x.iteration,totalIterations:iterations,feedback:x.feedback});}});
 await saveProgress({phase:research.status==='RESEARCH_CYCLE_STOPPED'?'STOPPED':'COMPLETED',loadedCandles:loaded.loadedCandles,completedWindows:loaded.completedWindows,completedIterations:research.completedIterations??0});
 return {...research,source:'SUPABASE_READ_ONLY',dataVerified:true,loadedCandles:loaded.loadedCandles,windowCount:loaded.plan.windowCount};
}
