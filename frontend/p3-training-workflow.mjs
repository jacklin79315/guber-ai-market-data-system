import {p2ClosedToTrainingSamples} from './p3-p2-training-samples.mjs';
import {fitCohortModels} from './p3-trade-cohorts.mjs';
import {evaluateWalkForward} from './p3-walk-forward.mjs';
// Offline research only. The caller supplies P2 realized trades and decision-time contexts.
export function trainP3WinProbability({closed,candles,decisionContexts,cutoffMs,minSamples=30}={}){
 if(!Number.isSafeInteger(cutoffMs)||cutoffMs<0||!Number.isSafeInteger(minSamples)||minSamples<1)throw Error('invalid P3 training settings');
 const samples=p2ClosedToTrainingSamples({closed,candles,decisionContexts,cutoffMs});
 const validation=evaluateWalkForward(samples,{minSamples});
 const fitted=fitCohortModels(samples,{cutoffMs,minSamples});
 const ready=Object.entries(fitted.models).filter(([,m])=>m.status==='READY').map(([cohort,m])=>({cohort,sampleCount:m.sampleCount,winProbability:m.probability}));
 return {status:ready.length?'TRAINED':'INSUFFICIENT_DATA',cutoffMs,totalClosedSamples:samples.length,readyCohorts:ready,validation:{status:validation.status,total:validation.total,evaluated:validation.evaluated,skipped:validation.skipped,brierScore:validation.brierScore,referenceBrierScore:validation.referenceBrierScore},model:fitted};
}
