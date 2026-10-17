import {loadHistoricalCandles} from './p2-historical-reader.mjs';
import {replayBrainDecisions} from './p3-brain-p2-replay.mjs';
// Research-only bridge. The caller supplies an authorized read-only candle fetcher.
export async function replayBrainHistoricalCandles({fetchPage,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,decisions,accountOptions={},costs}={}){
 if(!Array.isArray(decisions))throw Error('Brain decisions required');
 const candles=await loadHistoricalCandles({fetchPage,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs});
 return replayBrainDecisions({candles,decisions,accountOptions,costs});
}
