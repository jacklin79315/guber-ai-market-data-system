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
  if(actor==='Brain'&&step!==history.filter(h=>h?.expert==='brain').at(-1))continue;
  seen.add(actor);
  // A Risk WAIT for non-positive expectancy is a narrow, auditable guardrail
  // verdict only when the proposal explicitly records non-positive EV.
  // It does not establish predictive skill or certify the whole WAIT decision.
  if(actor==='Risk'&&step.action==='WAIT'&&step.reason==='NON_POSITIVE_EXPECTANCY'&&evidence.action==='WAIT'){
   const ev=evidence.proposalAtDecision?.expectedValue;
   if(typeof ev==='number'&&Number.isFinite(ev)){
    results.push({actor,quality:ev<=0?'SOUND':'FAULT',responsibility:ev<=0?'NONE':'PRIMARY',reason:ev<=0?'Risk correctly waited on recorded non-positive expectancy':'Risk claimed non-positive expectancy despite positive recorded value',evidenceKeys:['expertHistory','proposalAtDecision','action']});
   }
   continue;
  }
  // A recorded Brain approval must match the final replay action. A mismatch is
  // an auditable decision-chain fault, independent of subsequent PnL.
  // Brain safety veto is a distinct final gate, not a contradictory Brain verdict.
  // Do not punish a Brain approval simply because the safety layer blocked it.
  const safetyVeto=history.some(h=>h?.expert==='brainSafety'&&h.action==='WAIT'&&Array.isArray(h.issues)&&h.issues.length>0);
  if(actor==='Brain'&&step.action==='APPROVE'&&evidence.action!=='APPROVE'&&safetyVeto)continue;
  if(actor==='Brain'&&step.action==='APPROVE'&&evidence.action!=='APPROVE'){
   results.push({actor,quality:'FAULT',responsibility:'PRIMARY',reason:'Brain approval conflicts with the final recorded decision',evidenceKeys:['expertHistory','action']});
   continue;
  }
  if(actor==='Brain'&&evidence.action==='APPROVE'&&step.action!=='APPROVE'){
   results.push({actor,quality:'FAULT',responsibility:'PRIMARY',reason:'Final approval lacks a matching Brain approval',evidenceKeys:['expertHistory','action']});
   continue;
  }
 // A formal rejection or WAIT by an expert is not inherently wrong.
  // Only contradictory evidence is eligible for an attributable fault.
  if(step.action==='CONTINUE'&&step.reason==='NON_POSITIVE_EXPECTANCY'){
   results.push({actor,quality:'FAULT',responsibility:'PRIMARY',reason:'Expert continued despite explicitly recording non-positive expectancy',evidenceKeys:['expertHistory']});
  }
 }
 return results;
}

// Inspect proposal invariants only. These do not establish predictive quality.
export function assessP4ProposalInvariants({evidence}={}){
 if(!evidence||typeof evidence!=='object')throw Error('invalid proposal evidence');
 const p=evidence.proposalAtDecision;
 if(!p||typeof p!=='object'||evidence.action!=='APPROVE')return [];
 const results=[];
 // Check only explicit proposal invariants. No look-ahead and no PnL blame.
 if(typeof p.expectedHoldingMs==='number'&&Number.isFinite(p.expectedHoldingMs)&&p.expectedHoldingMs<=0){
  results.push({actor:'Time',quality:'FAULT',responsibility:'PRIMARY',reason:'Approved proposal has a non-positive expected holding duration',evidenceKeys:['proposalAtDecision']});
 }
 if(Array.isArray(p.entryRange)&&p.entryRange.length===2&&p.entryRange.every(Number.isFinite)&&p.entryRange[0]>p.entryRange[1]){
  results.push({actor:'Entry',quality:'FAULT',responsibility:'PRIMARY',reason:'Approved proposal entry range has reversed bounds',evidenceKeys:['proposalAtDecision']});
 }
 const rr=p.riskReward, gain=p.expectedGain,loss=p.expectedLoss;
 if([rr,gain,loss].every(v=>typeof v==='number'&&Number.isFinite(v))&&loss>0&&gain>=0){
  if(Math.abs(rr-gain/loss)>1e-6*Math.max(1,Math.abs(rr)))results.push({actor:'Reward',quality:'FAULT',responsibility:'PRIMARY',reason:'Recorded risk/reward contradicts expected gain divided by expected loss',evidenceKeys:['proposalAtDecision']});
 }
 // Explicit probability bounds are a decision-time invariant, not an outcome label.
 // Keep missing/uncalibrated probability UNKNOWN rather than inventing a fault.
 if(typeof p.winProbability==='number'&&Number.isFinite(p.winProbability)&&(p.winProbability<0||p.winProbability>1)){
  results.push({actor:'Win',quality:'FAULT',responsibility:'PRIMARY',reason:'Approved proposal contains a probability outside [0,1]',evidenceKeys:['proposalAtDecision']});
  return results;
 }
 // An explicitly computed negative expectancy cannot justify an approval.
 // Do not infer negativity when expectancy is absent or uncalibrated.
 if(typeof p.expectedValue==='number'&&Number.isFinite(p.expectedValue)&&p.expectedValue<0&&!results.some(x=>x.actor==='Reward')){
  results.push({actor:'Reward',quality:'FAULT',responsibility:'PRIMARY',reason:'Approved proposal has explicitly negative expected value',evidenceKeys:['proposalAtDecision']});
 }
 const prob=p.winProbability,ev=p.expectedValue;
 if([prob,ev,gain,loss].every(v=>typeof v==='number'&&Number.isFinite(v))&&prob>=0&&prob<=1&&loss>0&&gain>=0){
  const expected=prob*gain-(1-prob)*loss;
  if(Math.abs(ev-expected)>1e-6*Math.max(1,Math.abs(ev)))results.push({actor:'Win',quality:'FAULT',responsibility:'PRIMARY',reason:'Expected value contradicts probability-weighted gain and loss',evidenceKeys:['proposalAtDecision']});
 }
 return results;
}
