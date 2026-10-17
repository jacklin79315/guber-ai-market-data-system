import {reviewBrainProposal} from './p3-brain-review.mjs';
import {EXPERT_ORDER,BRAIN_ACTIONS,applyExpertPatch,createProposalContext} from './p3-contract.mjs';
// P3 orchestration only. Expert implementations are injected, not simulated AI.
export async function runExpertPipeline({context,experts,brain,maxReturns=2}={}){
 const base=createProposalContext(context);
 if(!experts||typeof experts!=='object'||EXPERT_ORDER.some(name=>typeof experts[name]!=='function')||typeof brain!=='function'||!Number.isInteger(maxReturns)||maxReturns<0||maxReturns>5)throw Error('invalid P3 pipeline settings');
 let state=base,stage=0,returns=0;const history=[];
 for(let steps=0;steps<50;steps++){
  if(stage<EXPERT_ORDER.length){const name=EXPERT_ORDER[stage];const result=await experts[name](structuredClone(state));
   if(name==='riskPosition'&&result?.action==='RETURN'){
    if(result.target!=='reward'||typeof result.reason!=='string'||!result.reason.trim())throw Error('risk may return only to reward');
    history.push({expert:name,action:'RETURN',target:'reward',reason:result.reason});
    if(returns>=maxReturns)return {action:'WAIT',reason:'Risk return limit reached',proposal:state,history};
    const clear=new Set(EXPERT_ORDER.slice(EXPERT_ORDER.indexOf('reward')).flatMap(n=>({reward:['tpRange','slRange','riskReward','expectedGain','expectedLoss','rewardReason'],winProbability:['winProbability','expectedValue','probabilityReason'],riskPosition:['allocation','riskReason'],time:['expectedHoldingMs','timeUncertainty']}[n]||[])));
    state=Object.fromEntries(Object.entries(state).filter(([key])=>!clear.has(key)));stage=EXPERT_ORDER.indexOf('reward');returns++;continue;
   }
   if(result?.action==='WAIT'&&typeof result.reason==='string'&&result.reason.trim()){history.push({expert:name,action:'WAIT',reason:result.reason});return {action:'WAIT',reason:result.reason,proposal:state,history};}
   if(!result||result.action!=='CONTINUE'||!result.patch)throw Error('invalid expert output');
   state=applyExpertPatch(name,state,result.patch);history.push({expert:name,action:'CONTINUE'});stage++;continue;
  }
  const verdict=await brain(structuredClone(state));
  if(!verdict||!BRAIN_ACTIONS.includes(verdict.action)||typeof verdict.reason!=='string'||!verdict.reason.trim())throw Error('invalid Brain verdict');
  history.push({expert:'brain',action:verdict.action,reason:verdict.reason});
  if(verdict.action==='APPROVE'){
   const review=reviewBrainProposal(state);
   if(!review.ok){history.push({expert:'brainSafety',action:'WAIT',issues:review.issues});return {action:'WAIT',reason:'Brain safety review failed: '+review.issues.join(','),proposal:state,history};}
  }
  if(verdict.action!=='RETURN')return {action:verdict.action,reason:verdict.reason,proposal:state,history};
  const target=EXPERT_ORDER.indexOf(verdict.target);
  if(target<0)throw Error('invalid Brain return target');
  if(returns>=maxReturns)return {action:'WAIT',reason:'Brain return limit reached',proposal:state,history};
  // Clear target and every downstream-owned field before rerunning them.
  const keysToClear=new Set(EXPERT_ORDER.slice(target).flatMap(name=>({entry:['symbol','side','timeframe','entryRange','entryReason'],reward:['tpRange','slRange','riskReward','expectedGain','expectedLoss','rewardReason'],winProbability:['winProbability','expectedValue','probabilityReason'],riskPosition:['allocation','riskReason'],time:['expectedHoldingMs','timeUncertainty']}[name])));
  state=Object.fromEntries(Object.entries(state).filter(([key])=>!keysToClear.has(key)));stage=target;returns++;
 }
 throw Error('P3 pipeline exceeded safety steps');
}
