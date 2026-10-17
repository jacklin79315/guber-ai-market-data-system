// Research-only empirical probability estimator. No signals or trade execution.
// Inputs must be closed, time-ordered observations from the same feature cohort.
export function fitWinProbability(samples,{cutoffMs,minSamples=30,priorWins=1,priorLosses=1}={}){
 if(!Array.isArray(samples)||!Number.isSafeInteger(cutoffMs)||cutoffMs<0||!Number.isSafeInteger(minSamples)||minSamples<1||!Number.isFinite(priorWins)||priorWins<=0||!Number.isFinite(priorLosses)||priorLosses<=0)throw Error('invalid training settings');
 const seen=new Set();let wins=0,losses=0;
 for(const s of samples){
  if(!s||typeof s.id!=='string'||!s.id||seen.has(s.id)||!Number.isSafeInteger(s.decisionTime)||!Number.isSafeInteger(s.closedTime)||s.decisionTime<0||s.closedTime<s.decisionTime||s.closedTime>=cutoffMs||!['WIN','LOSS'].includes(s.outcome))throw Error('invalid or future training sample');
  seen.add(s.id);if(s.outcome==='WIN')wins++;else losses++;
 }
 const count=wins+losses;
 if(count<minSamples)return {status:'INSUFFICIENT_DATA',sampleCount:count,required:minSamples,probability:null,cutoffMs};
 return {status:'READY',sampleCount:count,wins,losses,probability:(wins+priorWins)/(count+priorWins+priorLosses),cutoffMs,method:'beta_binomial_baseline'};
}
export function predictWinProbability(model,{decisionTime}={}){
 if(!model||model.status!=='READY'||!Number.isSafeInteger(decisionTime)||decisionTime<model.cutoffMs)throw Error('model not ready or prediction precedes training cutoff');
 return {winProbability:model.probability,sampleCount:model.sampleCount,modelMethod:model.method,trainingCutoffMs:model.cutoffMs};
}
