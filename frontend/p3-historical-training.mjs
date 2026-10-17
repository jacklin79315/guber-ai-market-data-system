import {createSupabaseCandlePageFetcher,loadHistoricalCandles} from './p2-historical-reader.mjs';
import {replayCandles} from './p2-replay.mjs';
import {trainP3WinProbability} from './p3-training-workflow.mjs';
// Read-only research workflow. Proposals and decision-time market states must be supplied by actual experts.
export async function trainP3FromHistoricalCandles({supabaseUrl,apiKey,fetchImpl=fetch,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,proposals,decisionContexts,costs,accountOptions={},minSamples=30}={}){
 if(!Array.isArray(proposals)||!Array.isArray(decisionContexts)||!costs||!Number.isSafeInteger(asOfMs)||!Number.isSafeInteger(fromOpenTime)||!Number.isSafeInteger(toOpenTime)||toOpenTime<fromOpenTime||asOfMs<=toOpenTime)throw Error('invalid historical training inputs');
 if(proposals.length!==decisionContexts.length||new Set(proposals.map(p=>p.id)).size!==proposals.length||new Set(decisionContexts.map(c=>c.id)).size!==decisionContexts.length||proposals.some(p=>p.symbol!==symbol||p.timeframe!==timeframe||!decisionContexts.some(c=>c.id===p.id)))throw Error('missing or mismatched expert proposals');
 const fetchPage=createSupabaseCandlePageFetcher({supabaseUrl,anonKey:apiKey,fetchImpl});
 const candles=await loadHistoricalCandles({fetchPage,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs});
 if(!candles.length)return {status:'NO_HISTORICAL_CANDLES',candleCount:0,closedTrades:0,training:null};
 const replay=replayCandles({candles,proposals,costs,accountOptions});
 const training=trainP3WinProbability({closed:replay.account.closed,candles,decisionContexts,cutoffMs:asOfMs,minSamples});
 return {status:training.status,candleCount:candles.length,closedTrades:replay.account.closed.length,unclosedTrades:replay.account.positions.length,cancelledTrades:replay.account.cancelled.length,training};
}
