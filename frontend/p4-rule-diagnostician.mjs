// Narrow, independently auditable hard-cap check. No PnL-based blame.
// Absence of causal account evidence means no verdict, not a guessed rating.
export function assessP4RiskEvidence({outcome,evidence}={}){
 if(!['CLOSED','SHADOW','WAIT','RETURN'].includes(outcome)||!evidence||typeof evidence!=='object')throw Error('invalid diagnostic evidence');
 if(evidence.action!=='APPROVE')return [];
 const {equity,committedCapital}=evidence.accountAtDecision??{};
 const allocation=evidence.allocation;
 if(![equity,committedCapital,allocation].every(v=>typeof v==='number'&&Number.isFinite(v))||equity<=0||committedCapital<0||allocation<=0)return [];
 const utilization=(committedCapital+allocation)/equity;
 // The global simulation contract caps committed capital at 80% of equity.
 if(utilization>0.8+1e-9)return [{actor:'Risk',quality:'FAULT',responsibility:'PRIMARY',reason:'Approved allocation exceeds the 80% portfolio utilization hard limit at decision time',evidenceKeys:['accountAtDecision','allocation']}];
 return [{actor:'Risk',quality:'SOUND',responsibility:'NONE',reason:'Approved allocation respects the 80% portfolio utilization hard limit; other risk dimensions remain unverified',evidenceKeys:['accountAtDecision','allocation']}];
}
