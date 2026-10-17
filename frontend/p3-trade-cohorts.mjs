import {fitWinProbability,predictWinProbability} from './p3-win-probability-model.mjs';
// Cohorts are explicit observable market states, not inferred from future PnL.
const STATES=new Set(['TREND_UP','TREND_DOWN','RANGE','HIGH_VOLATILITY','UNCLEAR']);
const SIDES=new Set(['LONG','SHORT']);
const TF=new Set(['15m','1h','4h','1d']);
export function cohortKey({marketState,side,timeframe}={}){
 if(!STATES.has(marketState)||!SIDES.has(side)||!TF.has(timeframe))throw Error('invalid historical market cohort');
 return [marketState,side,timeframe].join('|');
}
export function buildClosedTradeSamples(trades,{cutoffMs}={}){
 if(!Array.isArray(trades)||!Number.isSafeInteger(cutoffMs)||cutoffMs<0)throw Error('invalid historical sample settings');
 const seen=new Set();const result=[];
 for(const t of trades){
  if(!t||typeof t.id!=='string'||!t.id||seen.has(t.id)||!Number.isSafeInteger(t.decisionTime)||!Number.isSafeInteger(t.closedTime)||t.decisionTime<0||t.closedTime<t.decisionTime||t.closedTime>=cutoffMs||!Number.isFinite(t.netPnl)||t.netPnl===0)throw Error('invalid or unavailable closed trade');
  seen.add(t.id);const key=cohortKey(t);
  result.push({id:t.id,decisionTime:t.decisionTime,closedTime:t.closedTime,outcome:t.netPnl>0?'WIN':'LOSS',cohort:key});
 }
 return result;
}
export function fitCohortModels(samples,{cutoffMs,minSamples=30}={}){
 if(!Array.isArray(samples))throw Error('invalid cohort samples');
 const groups=new Map();
 for(const sample of samples){if(!sample||typeof sample.cohort!=='string'||sample.cohort.split('|').length!==3)throw Error('invalid cohort label');const [marketState,side,timeframe]=sample.cohort.split('|');const key=cohortKey({marketState,side,timeframe});if(!groups.has(key))groups.set(key,[]);groups.get(key).push(sample)}
 const models={};for(const [key,rows] of groups)models[key]=fitWinProbability(rows,{cutoffMs,minSamples});
 return {cutoffMs,models};
}
export function predictCohortProbability(fitted,cohort,{decisionTime}={}){
 const key=cohortKey(cohort);const model=fitted?.models?.[key];
 if(!model||model.status!=='READY')return {status:'INSUFFICIENT_DATA',cohort:key,winProbability:null};
 return {status:'READY',cohort:key,...predictWinProbability(model,{decisionTime})};
}
