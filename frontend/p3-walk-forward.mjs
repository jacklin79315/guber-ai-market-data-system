import {fitCohortModels,predictCohortProbability} from './p3-trade-cohorts.mjs';
// Walk-forward evaluation: train only on trades closed strictly before each decision.
export function evaluateWalkForward(samples,{minSamples=30}={}){
 if(!Array.isArray(samples)||!Number.isSafeInteger(minSamples)||minSamples<1)throw Error('invalid walk-forward settings');
 const ordered=[...samples].sort((a,b)=>a.decisionTime-b.decisionTime||a.id.localeCompare(b.id));
 const ids=new Set();const predictions=[];let skipped=0;
 for(const target of ordered){
  if(!target||typeof target.id!=='string'||!target.id||ids.has(target.id)||!Number.isSafeInteger(target.decisionTime)||!Number.isSafeInteger(target.closedTime)||target.closedTime<target.decisionTime||!['WIN','LOSS'].includes(target.outcome))throw Error('invalid walk-forward sample');
  ids.add(target.id);
  const history=ordered.filter(s=>s.id!==target.id&&Number.isSafeInteger(s.closedTime)&&s.closedTime<target.decisionTime);
  const fitted=fitCohortModels(history,{cutoffMs:target.decisionTime,minSamples});
  const [marketState,side,timeframe]=target.cohort.split('|');
  const prediction=predictCohortProbability(fitted,{marketState,side,timeframe},{decisionTime:target.decisionTime});
  if(prediction.status!=='READY'){skipped++;continue}
  const actual=target.outcome==='WIN'?1:0;
  predictions.push({id:target.id,decisionTime:target.decisionTime,probability:prediction.winProbability,actual,cohort:target.cohort,trainingSamples:prediction.sampleCount});
 }
 const n=predictions.length;
 const brier=n?predictions.reduce((s,p)=>s+(p.probability-p.actual)**2,0)/n:null;
 const baseRate=n?predictions.reduce((s,p)=>s+p.actual,0)/n:null;
 const baselineBrier=n?predictions.reduce((s,p)=>s+(baseRate-p.actual)**2,0)/n:null;
 return {status:n?'EVALUATED':'INSUFFICIENT_DATA',total:samples.length,evaluated:n,skipped,brierScore:brier,referenceBrierScore:baselineBrier,predictions};
}
