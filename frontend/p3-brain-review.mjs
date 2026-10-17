// Deterministic P3 Brain safety gate. This is not an AI trading decision.
const range=x=>Array.isArray(x)&&x.length===2&&x.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0)&&x[0]<=x[1];
const text=x=>typeof x==='string'&&x.trim().length>0;
export function reviewBrainProposal(p){
 const issues=[];
 if(!p||typeof p!=='object'||Array.isArray(p))return {ok:false,issues:['INVALID_PROPOSAL']};
 if(!text(p.id)||!Number.isSafeInteger(p.decisionTime)||p.decisionTime<0||!text(p.modelVersion)||!p.marketSnapshot||!Number.isSafeInteger(p.marketSnapshot.asOfMs)||p.marketSnapshot.asOfMs>p.decisionTime)issues.push('INVALID_CONTEXT');
 if(!/^[A-Z0-9]{3,30}$/.test(p.symbol||'')||!['LONG','SHORT'].includes(p.side)||!['15m','1h','4h','1d'].includes(p.timeframe)||!range(p.entryRange)||!text(p.entryReason))issues.push('INVALID_ENTRY');
 if(!range(p.tpRange)||!range(p.slRange)||!Number.isFinite(p.riskReward)||p.riskReward<0||!Number.isFinite(p.expectedGain)||p.expectedGain<0||!Number.isFinite(p.expectedLoss)||p.expectedLoss<0||!text(p.rewardReason))issues.push('INVALID_REWARD');
 if(range(p.entryRange)&&range(p.tpRange)&&range(p.slRange)){
  if(p.side==='LONG'&&!(p.slRange[1]<p.entryRange[0]&&p.tpRange[0]>p.entryRange[1])||p.side==='SHORT'&&!(p.tpRange[1]<p.entryRange[0]&&p.slRange[0]>p.entryRange[1]))issues.push('INCONSISTENT_LEVELS');
 }
 if(!(p.winProbability===null&&p.expectedValue===null||Number.isFinite(p.winProbability)&&p.winProbability>=0&&p.winProbability<=1&&Number.isFinite(p.expectedValue))||!text(p.probabilityReason))issues.push('INVALID_PROBABILITY');
 if(!Number.isFinite(p.allocation)||p.allocation<=0||!text(p.riskReason))issues.push('INVALID_ALLOCATION');
 if(!Number.isSafeInteger(p.expectedHoldingMs)||p.expectedHoldingMs<=0||!text(p.timeUncertainty))issues.push('INVALID_TIME');
 return {ok:issues.length===0,issues};
}
