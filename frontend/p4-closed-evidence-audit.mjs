// Audit the exact diagnostic records about to be persisted; never repair evidence.
export function auditP4ClosedEvidence(records){
 if(!Array.isArray(records))throw Error('invalid P4 evidence records');
 const counts={closed:0,validCloseTime:0,validOutcome:0,validProbability:0,calibrationReady:0};
 for(const row of records){
  if(row?.diagnosis?.outcome!=='CLOSED')continue;
  counts.closed++;
  const e=row.evidence??{},p=e.proposalAtDecision?.winProbability;
  const time=Number.isSafeInteger(e.decisionTime)&&Number.isSafeInteger(e.closedAt)&&e.closedAt>e.decisionTime;
  const outcome=typeof e.realizedWin==='boolean';
  const probability=typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=1;
  if(time)counts.validCloseTime++;
  if(outcome)counts.validOutcome++;
  if(probability)counts.validProbability++;
  if(time&&outcome&&probability)counts.calibrationReady++;
 }
 return {schemaVersion:'P4_CLOSED_EVIDENCE_AUDIT_V1',...counts,complete:counts.closed>0&&counts.closed===counts.calibrationReady,mode:'RESEARCH_ONLY',modelUpdateApplied:false};
}
