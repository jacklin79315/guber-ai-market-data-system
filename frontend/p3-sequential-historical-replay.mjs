import {loadHistoricalCandles,createSupabaseCandlePageFetcher} from './p2-historical-reader.mjs';
import {createSupabaseFeatureAtDecision} from './p3-supabase-feature-reader.mjs';
import {runSequentialFiveExpertReplay} from './p3-sequential-replay.mjs';
import {createInferenceTransport} from './p3-inference-transport.mjs';
import {createBrainModelAdapter} from './p3-model-adapters.mjs';
// Read-only historical source -> chronological five-expert research -> P2 paper simulation.
// The caller must supply causal features and a Brain decision function. No fabricated AI.
export async function runSequentialHistoricalReplay({fetchPage,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},lookback=20,threshold=0.001,minProbabilitySamples=30,minTimeSamples=10,maxDecisions=100000,trainingParameters,modelVersion='P3_RESEARCH_V1'}={}){
 if(typeof featureAtDecision!=='function'||typeof brain!=='function')throw Error('explicit feature and Brain providers required');
 const candles=await loadHistoricalCandles({fetchPage,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs});
 const result=await runSequentialFiveExpertReplay({candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions,lookback,threshold,minProbabilitySamples,minTimeSamples,maxDecisions,trainingParameters,modelVersion});
 return {...result,source:'HISTORICAL_READ_ONLY',symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,loadedCandles:candles.length};
}

// Explicit Supabase-backed entrypoint. Feature snapshots and Brain must be supplied
// by real, versioned providers; this adapter never synthesizes model observations.
export async function runSupabaseSequentialFiveExpertReplay({supabaseUrl,apiKey,fetchImpl=fetch,...options}={}){
 const fetchPage=createSupabaseCandlePageFetcher({supabaseUrl,anonKey:apiKey,fetchImpl});
 return runSequentialHistoricalReplay({...options,fetchPage});
}

// Fully database-backed candles and features; Brain is still explicit and versioned by caller.
export async function runSupabaseFeatureBackedReplay({supabaseUrl,apiKey,fetchImpl=fetch,featureAtDecision,...options}={}){
 if(featureAtDecision!==undefined)throw Error('feature override not allowed in database-backed replay');
 if(typeof options.brain!=='function'||typeof options.modelVersion!=='string'||!options.modelVersion.trim())throw Error('explicit versioned Brain required');
 const reader=createSupabaseFeatureAtDecision({supabaseUrl,apiKey,fetchImpl});
 return runSupabaseSequentialFiveExpertReplay({...options,supabaseUrl,apiKey,fetchImpl,featureAtDecision:reader});
}

// Explicit inference-backed Brain, never a synthetic approval. The five research
// experts remain deterministic baselines, not remotely trained expert models.
export async function runSupabaseInferenceBrainReplay({inferenceEndpoint,inferenceToken,brainVersion,inferenceFetchImpl,timeoutMs,...options}={}){
 if(typeof brainVersion!=='string'||!brainVersion.trim()||options.brain!==undefined)throw Error('explicit inference Brain version required; override forbidden');
 const infer=createInferenceTransport({endpoint:inferenceEndpoint,token:inferenceToken,fetchImpl:inferenceFetchImpl,timeoutMs});
 const brain=createBrainModelAdapter({infer,modelVersion:brainVersion});
 return runSupabaseFeatureBackedReplay({...options,brain,modelVersion:brainVersion});
}
