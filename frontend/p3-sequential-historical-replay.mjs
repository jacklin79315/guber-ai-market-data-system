import {loadHistoricalCandles} from './p2-historical-reader.mjs';
import {runSequentialFiveExpertReplay} from './p3-sequential-replay.mjs';
// Read-only historical source -> chronological five-expert research -> P2 paper simulation.
// The caller must supply causal features and a Brain decision function. No fabricated AI.
export async function runSequentialHistoricalReplay({fetchPage,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},lookback=20,threshold=0.001,minProbabilitySamples=30,minTimeSamples=10,maxDecisions=100000}={}){
 if(typeof featureAtDecision!=='function'||typeof brain!=='function')throw Error('explicit feature and Brain providers required');
 const candles=await loadHistoricalCandles({fetchPage,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs});
 const result=await runSequentialFiveExpertReplay({candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions,lookback,threshold,minProbabilitySamples,minTimeSamples,maxDecisions});
 return {...result,source:'HISTORICAL_READ_ONLY',symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,loadedCandles:candles.length};
}
