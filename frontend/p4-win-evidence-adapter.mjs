// Conservative adapter from persisted P4 diagnosis to calibration observations.
// Never manufacture missing probabilities or derive win probability from PnL.
export function extractP4ClosedWinObservations({records}={}){
 if(!Array.isArray(records))throw Error('invalid P4 diagnostic records');
 const observations=[],excluded={nonClosed:0,missingProbability:0,missingOutcome:0,missingTimestamps:0,unresolved:0,invalidProbability:0};
 let unresolvedIncluded=0;
 for(const r of records){
  if(r?.diagnosis?.schemaVersion!=='P4_DIAGNOSIS_V1'||r?.feedback?.schemaVersion!=='P4_FEEDBACK_V1'||!r.evidence||typeof r.evidence!=='object')throw Error('unverified P4 diagnostic record');
  if(r.diagnosis.outcome!=='CLOSED'){excluded.nonClosed++;continue;}
  const needsReview=r.diagnosis.requiresReview===true||r.feedback.requiresReview===true;
  if(needsReview)excluded.unresolved++;
  const e=r.evidence,p=e.proposalAtDecision?.winProbability;
  if(p==null){excluded.missingProbability++;continue;}\n  if(typeof p!=='number'||!Number.isFinite(p)||p<0||p>1){excluded.invalidProbability++;continue;}
  // Require original, explicit timestamps and realized binary labels. Never infer missing facts.
  if(!Number.isSafeInteger(e.decisionTime)||!Number.isSafeInteger(e.closedAt)||e.closedAt<=e.decisionTime){excluded.missingTimestamps++;continue;}
  if(e.realizedWin!==true&&e.realizedWin!==false){excluded.missingOutcome++;continue;}
  observations.push({decidedAt:e.decisionTime,closedAt:e.closedAt,probability:p,outcome:e.realizedWin?1:0});
  if(needsReview)unresolvedIncluded++;
 }
 return {schemaVersion:'P4_CLOSED_WIN_OBSERVATIONS_V1',mode:'RESEARCH_ONLY',observations,excluded,unresolvedIncluded,totalRecords:records.length,modelUpdateApplied:false,championPromotionAllowed:false};
}
