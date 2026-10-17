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

// Check recorded expert decisions against the causal evidence available at decision time.
// These are narrow invariant checks, not retrospective profitability judgments.
export function assessP4ExpertHistory({evidence}={}){
 if(!evidence||typeof evidence!=='object')throw Error('invalid expert history evidence');
 const history=evidence.expertHistory;
 if(!Array.isArray(history))return [];
 const results=[];
 const seen=new Set();
 const actorFor={entry:'Entry',reward:'Reward',winProbability:'Win',riskPosition:'Risk',time:'Time',brain:'Brain'};
 for(const step of history){
  if(!step||typeof step!=='object')continue;
  const actor=actorFor[step.expert]??actorFor[String(step.expert??'').replace(/[-_ ]/g,'').toLowerCase()];
  if(!actor||seen.has(actor))continue;
  seen.add(actor);
  // A formal rejection or WAIT by an expert is not inherently wrong.
  // Only contradictory evidence is eligible for an attributable fault.
  if(step.action==='CONTINUE'&&step.reason==='NON_POSITIVE_EXPECTANCY'){
   results.push({actor,quality:'FAULT',responsibility:'PRIMARY',reason:'Expert continued despite explicitly recording non-positive expectancy',evidenceKeys:['expertHistory']});
  }
 }
 return results;
}
