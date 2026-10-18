// Explicit server-side diagnostic research using verified Supabase candle history.
// Research-only. Never invoked by deployment, never places orders or promotes models.
import {loadP4SegmentedHistoricalCandles} from './p4-segmented-reader.mjs';
import {createSupabaseFeatureAtDecision} from './p3-supabase-feature-reader.mjs';
import {runP4ChronologicalDiagnosticResearch} from './p4-diagnostic-chronological-run.mjs';
import {summarizeP4DiagnosticResearch} from './p4-diagnostic-research-summary.mjs';
export async function runP4DiagnosticBackendResearch({confirm,supabaseUrl,apiKey,fetchImpl=fetch,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,task,parentParameters,brain,costs,historyAtDecision,shouldStop=()=>false,onProgress,maxArms=6,explorationSteps=[1],validationFraction=0.2,researchJobId,onResearchSummary}={}){
 if(confirm!=='RESEARCH_ONLY')throw Error('P4 diagnostic backend disabled without RESEARCH_ONLY confirmation');
 if(onResearchSummary!==undefined&&(typeof onResearchSummary!=='function'||typeof researchJobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(researchJobId)))throw Error('invalid diagnostic research summary writer');
 if(typeof brain!=='function'||typeof shouldStop!=='function'||(onProgress!==undefined&&typeof onProgress!=='function'))throw Error('invalid diagnostic backend controls');
 const loaded=await loadP4SegmentedHistoricalCandles({supabaseUrl,apiKey,fetchImpl,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,shouldStop,onProgress});
 if(!loaded.verified||shouldStop())return {status:'STOPPED_BEFORE_DIAGNOSTIC_RESEARCH',loadedCandles:loaded.loadedCandles,mode:'RESEARCH_ONLY',ordersEnabled:false};
 const featureAtDecision=createSupabaseFeatureAtDecision({supabaseUrl,apiKey,fetchImpl});
 const first=loaded.candles[0],last=loaded.candles.at(-1);
 await featureAtDecision.prefetch({symbol,timeframe,fromCloseTime:first.closeTime,toCloseTime:last.closeTime,onPage:async page=>{if(shouldStop())throw Error('P4 diagnostic feature prefetch stopped');await onProgress?.({phase:'FEATURE_PREFETCH',...page});}});
 const result=await runP4ChronologicalDiagnosticResearch({candles:loaded.candles,task,parentParameters,brain,costs,historyAtDecision,featureAtDecision,shouldStop,maxArms,explorationSteps,validationFraction});
 if(onResearchSummary){const summary=summarizeP4DiagnosticResearch({result:{...result,source:'VERIFIED_SUPABASE_HISTORY',loadedCandles:loaded.loadedCandles},jobId:researchJobId,createdAtMs:Date.now()});await onResearchSummary(summary);}
 return {...result,source:'VERIFIED_SUPABASE_HISTORY',loadedCandles:loaded.loadedCandles,mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
