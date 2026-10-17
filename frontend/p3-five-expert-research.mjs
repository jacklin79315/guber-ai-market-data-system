import {runExpertPipeline} from './p3-pipeline.mjs';
import {estimateRewardBaseline} from './p3-reward-baseline.mjs';
import {estimateSimilarTradeProbability} from './p3-similarity-probability.mjs';
import {estimateRiskPositionBaseline} from './p3-risk-position-baseline.mjs';
import {estimateHoldingTimeBaseline} from './p3-time-baseline.mjs';
// Research-only complete expert chain. Brain is injected and never implicitly APPROVEs.
export async function runFiveExpertResearch({candidate,candles,features,tradeHistory,holdingHistory,account,feeRate,slippageRate,brain,minProbabilitySamples=30,minTimeSamples=10,modelVersion='P3_RESEARCH_V1'}={}){
 if(!candidate||!Number.isSafeInteger(candidate.decisionTime)||!features||!Number.isSafeInteger(features.asOfMs)||features.asOfMs>candidate.decisionTime||!Array.isArray(candles)||!Array.isArray(tradeHistory)||!Array.isArray(holdingHistory)||typeof brain!=='function')throw Error('invalid research chain inputs');
 const context={id:candidate.id,decisionTime:candidate.decisionTime,marketSnapshot:{asOfMs:features.asOfMs,features:structuredClone(features)},modelVersion};
 const experts={
  entry:async()=>({action:'CONTINUE',patch:{symbol:candidate.symbol,side:candidate.side,timeframe:candidate.timeframe,entryRange:candidate.entryRange,entryReason:candidate.entryReason}}),
  reward:async()=>{const r=estimateRewardBaseline({candidate,candles:candles.filter(b=>b.closeTime<=candidate.decisionTime),feeRate,slippageRate});return r.action==='WAIT'?{action:'WAIT',reason:r.reason||'REWARD_UNAVAILABLE'}:{action:'CONTINUE',patch:r.patch}},
  winProbability:async p=>estimateSimilarTradeProbability({proposal:p,features,history:tradeHistory,minSamples:minProbabilitySamples}),
  riskPosition:async p=>estimateRiskPositionBaseline({proposal:p,account}),
  time:async p=>estimateHoldingTimeBaseline({proposal:p,history:holdingHistory,minSamples:minTimeSamples})
 };
 return runExpertPipeline({context,experts,brain});
}
