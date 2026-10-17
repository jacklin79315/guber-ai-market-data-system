// P3 expert ownership contract. This module does not generate trade signals.
export const EXPERT_ORDER=Object.freeze(['entry','reward','winProbability','riskPosition','time']);
export const BRAIN_ACTIONS=Object.freeze(['APPROVE','RETURN','REJECT','WAIT']);
export const EXPERT_FIELDS=Object.freeze({entry:['symbol','side','timeframe','entryRange','entryReason'],reward:['tpRange','slRange','riskReward','expectedGain','expectedLoss','rewardReason'],winProbability:['winProbability','expectedValue','probabilityReason','probabilityConfidence','probabilitySampleCount'],riskPosition:['allocation','riskReason'],time:['expectedHoldingMs','timeUncertainty']});
const validRange=x=>Array.isArray(x)&&x.length===2&&x.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0)&&x[0]<=x[1];
const positiveText=x=>typeof x==='string'&&x.trim().length>0;
function validateStage(stage,p){
 if(stage==='entry'&&(!/^[A-Z0-9]{3,30}$/.test(p.symbol||'')||!['LONG','SHORT'].includes(p.side)||!['15m','1h','4h','1d'].includes(p.timeframe)||!validRange(p.entryRange)||!positiveText(p.entryReason)))throw Error('invalid entry proposal');
 if(stage==='reward'){
  if(!validRange(p.tpRange)||!validRange(p.slRange)||![p.riskReward,p.expectedGain,p.expectedLoss].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)||!positiveText(p.rewardReason))throw Error('invalid reward proposal');
  if(p.side==='LONG'&&!(p.slRange[1]<p.entryRange[0]&&p.tpRange[0]>p.entryRange[1])||p.side==='SHORT'&&!(p.tpRange[1]<p.entryRange[0]&&p.slRange[0]>p.entryRange[1]))throw Error('invalid reward direction');
 }
 if(stage==='winProbability'&&(!(p.winProbability===null&&p.expectedValue===null||Number.isFinite(p.winProbability)&&p.winProbability>=0&&p.winProbability<=1&&Number.isFinite(p.expectedValue))||!positiveText(p.probabilityReason)||(p.probabilityConfidence!==undefined&&!['UNKNOWN','LOW','MEDIUM','HIGH'].includes(p.probabilityConfidence))||(p.probabilitySampleCount!==undefined&&(!Number.isSafeInteger(p.probabilitySampleCount)||p.probabilitySampleCount<0))))throw Error('invalid probability proposal');
 if(stage==='riskPosition'&&(!Number.isFinite(p.allocation)||p.allocation<0||!positiveText(p.riskReason)))throw Error('invalid risk proposal');
 if(stage==='time'&&(!Number.isSafeInteger(p.expectedHoldingMs)||p.expectedHoldingMs<=0||!positiveText(p.timeUncertainty)))throw Error('invalid time proposal');
}
export function applyExpertPatch(stage,previous,patch){
 if(!EXPERT_ORDER.includes(stage)||!previous||typeof previous!=='object'||!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('invalid expert stage');
 const fields=EXPERT_FIELDS[stage];
 if(Object.keys(patch).some(key=>!fields.includes(key))||fields.filter(key=>!(stage==='winProbability'&&['probabilityConfidence','probabilitySampleCount'].includes(key))).some(key=>!Object.hasOwn(patch,key)))throw Error('expert field ownership violation');
 const merged={...previous,...patch};validateStage(stage,merged);return Object.freeze(merged);
}
export function createProposalContext({id,decisionTime,marketSnapshot,modelVersion}={}){
 if(typeof id!=='string'||!id.trim()||!Number.isSafeInteger(decisionTime)||decisionTime<0||!marketSnapshot||typeof marketSnapshot!=='object'||!Number.isSafeInteger(marketSnapshot.asOfMs)||marketSnapshot.asOfMs>decisionTime||typeof modelVersion!=='string'||!modelVersion.trim())throw Error('invalid P3 proposal context');
 return Object.freeze({id,decisionTime,marketSnapshot:structuredClone(marketSnapshot),modelVersion});
}
