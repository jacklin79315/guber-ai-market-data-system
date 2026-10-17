import {applyExpertPatch} from './p3-contract.mjs';
// Research baseline: historical nearest-neighbor win probability. Not a trained production model.
const FEATURES=['rsi','atrPercent','volumeRatio','trendStrength','momentum'];
function vector(x){if(!x||typeof x!=='object'||FEATURES.some(k=>!Number.isFinite(x[k])))throw Error('invalid similarity features');return FEATURES.map(k=>x[k])}
function distance(a,b){return Math.sqrt(a.reduce((sum,v,i)=>sum+((v-b[i])/(1+Math.abs(v)+Math.abs(b[i])))**2,0))}
export function estimateSimilarTradeProbability({proposal,features,history,minSamples=30,neighbors=50}={}){
 if(!proposal||!Number.isSafeInteger(proposal.decisionTime)||!['LONG','SHORT'].includes(proposal.side)||!Array.isArray(proposal.entryRange)||!Number.isFinite(proposal.expectedGain)||proposal.expectedGain<=0||!Number.isFinite(proposal.expectedLoss)||proposal.expectedLoss<=0||!Array.isArray(history)||!Number.isSafeInteger(minSamples)||minSamples<1||!Number.isSafeInteger(neighbors)||neighbors<minSamples)throw Error('invalid probability research settings');
 if(!Number.isSafeInteger(features?.asOfMs)||features.asOfMs>proposal.decisionTime||features.asOfMs<0)throw Error('future or undated decision features');
 const target=vector(features),seen=new Set(),eligible=[];
 for(const h of history){
  if(!h||typeof h.id!=='string'||!h.id||seen.has(h.id)||!Number.isSafeInteger(h.decisionTime)||!Number.isSafeInteger(h.closedTime)||h.decisionTime<0||h.closedTime<h.decisionTime||!['WIN','LOSS'].includes(h.outcome)||!['LONG','SHORT'].includes(h.side)||typeof h.symbol!=='string'||typeof h.timeframe!=='string')throw Error('invalid similarity history');
  seen.add(h.id);
  // Historical trades not yet closed at prediction time are never eligible.
  if(h.closedTime>=proposal.decisionTime||h.decisionTime>=proposal.decisionTime||h.side!==proposal.side||h.symbol!==proposal.symbol||h.timeframe!==proposal.timeframe)continue;
  if(!Number.isSafeInteger(h.features?.asOfMs)||h.features.asOfMs>h.decisionTime||h.features.asOfMs<0)throw Error('future or undated historical features');
  eligible.push({id:h.id,outcome:h.outcome,distance:distance(target,vector(h.features))});
 }
 eligible.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));const selected=eligible.slice(0,neighbors);
 if(selected.length<minSamples)return {action:'WAIT',reason:'INSUFFICIENT_SIMILAR_CLOSED_TRADES',eligibleCount:eligible.length,required:minSamples};
 const wins=selected.filter(x=>x.outcome==='WIN').length;
 const winProbability=(wins+1)/(selected.length+2); // explicit Beta(1,1) smoothing
 const expectedValue=winProbability*proposal.expectedGain-(1-winProbability)*proposal.expectedLoss;
 const patch={winProbability,expectedValue,probabilityReason:'Historical same-symbol, same-timeframe, same-side nearest-neighbor baseline; '+selected.length+' closed trades; '+wins+' wins; five known-at-decision features; Beta(1,1) smoothing; net reward estimates from Reward expert'};
 return {action:'CONTINUE',patch,sampleCount:selected.length,method:'SIMILARITY_KNN_BASELINE_V1',positiveExpectancy:expectedValue>0};
}
export function applySimilarityProbability({proposal,features,history,minSamples=30,neighbors=50}={}){
 const result=estimateSimilarTradeProbability({proposal,features,history,minSamples,neighbors});
 if(result.action==='WAIT')return result;
 return {...result,proposal:applyExpertPatch('winProbability',proposal,result.patch)};
}
