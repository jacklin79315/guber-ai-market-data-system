// P3 expert ownership contract. This module does not generate trade signals.
export const EXPERT_ORDER=Object.freeze(['entry','reward','winProbability','riskPosition','time']);
export const BRAIN_ACTIONS=Object.freeze(['APPROVE','RETURN','REJECT','WAIT']);
export const EXPERT_FIELDS=Object.freeze({entry:['symbol','side','timeframe','entryRange','entryReason'],reward:['tpRange','slRange','riskReward','expectedGain','expectedLoss','rewardReason'],winProbability:['winProbability','expectedValue','probabilityReason'],riskPosition:['allocation','riskReason'],time:['expectedHoldingMs','timeUncertainty']});
export function applyExpertPatch(stage,previous,patch){
 if(!EXPERT_ORDER.includes(stage)||!previous||typeof previous!=='object'||!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('invalid expert stage');
 const fields=EXPERT_FIELDS[stage];
 if(Object.keys(patch).some(key=>!fields.includes(key))||fields.some(key=>!Object.hasOwn(patch,key)))throw Error('expert field ownership violation');
 return Object.freeze({...previous,...patch});
}
export function createProposalContext({id,decisionTime,marketSnapshot,modelVersion}={}){
 if(typeof id!=='string'||!id.trim()||!Number.isSafeInteger(decisionTime)||decisionTime<0||!marketSnapshot||typeof marketSnapshot!=='object'||!Number.isSafeInteger(marketSnapshot.asOfMs)||marketSnapshot.asOfMs>decisionTime||typeof modelVersion!=='string'||!modelVersion.trim())throw Error('invalid P3 proposal context');
 return Object.freeze({id,decisionTime,marketSnapshot:structuredClone(marketSnapshot),modelVersion});
}
