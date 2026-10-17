import {loadHistoricalCandles,createSupabaseCandlePageFetcher} from './p2-historical-reader.mjs';
import {replayCandles} from './p2-replay.mjs';
import {trainP3WinProbability} from './p3-training-workflow.mjs';
const DURATIONS={'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};
// Offline, read-only bounded research entrypoint. Proposals and market-state contexts
// must originate from decision-time experts; this function never invents them.
export async function trainP3FromSupabase({supabaseUrl,apiKey,fetchImpl=fetch,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,proposals,decisionContexts,costs,accountOptions={},minSamples=30,maxCandles=10000}={}){
 const duration=DURATIONS[timeframe];
 if(!duration||typeof symbol!=='string'||!/^[A-Z0-9]{3,30}$/.test(symbol)||![fromOpenTime,toOpenTime,asOfMs].every(Number.isSafeInteger)||fromOpenTime<0||toOpenTime<fromOpenTime||toOpenTime+duration>asOfMs||!Number.isSafeInteger(maxCandles)||maxCandles<1||maxCandles>10000||Math.floor((toOpenTime-fromOpenTime)/duration)+1>maxCandles||!Array.isArray(proposals)||!Array.isArray(decisionContexts)||!costs)throw Error('invalid bounded P3 historical training request');
 if(proposals.some(p=>p.symbol!==symbol||p.timeframe!==timeframe))throw Error('cross-series proposals not supported');
 const fetchPage=createSupabaseCandlePageFetcher({supabaseUrl,anonKey:apiKey,fetchImpl});
 const candles=await loadHistoricalCandles({fetchPage,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs});
 if(candles.length>maxCandles)throw Error('historical training candle limit exceeded');
 if(!candles.length)throw Error('historical training candles unavailable');
 if(candles.length!==Math.floor((toOpenTime-fromOpenTime)/duration)+1||candles[0].closeTime!==fromOpenTime+duration-1||candles[candles.length-1].closeTime!==toOpenTime+duration-1||candles.some((c,i)=>i&&c.closeTime-candles[i-1].closeTime!==duration))throw Error('historical training candles missing or misaligned');
 const replay=replayCandles({candles,proposals,costs,accountOptions});
 const training=trainP3WinProbability({closed:replay.account.closed,candles,decisionContexts,cutoffMs:asOfMs,minSamples});
 return {symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,candlesRead:candles.length,proposalsSubmitted:proposals.length,realizedTrades:replay.account.closed.length,training,simulationMetrics:replay.metrics};
}
