// Bounded autonomous continuation of explicitly authorized research-only rounds.
// A persisted result must drive every next plan; no implicit model promotion or orders.
export async function runP4AutonomousResearchLoop({confirm,initialSummary,maxRounds,planNext,executeRound,onRound}={}){
 if(confirm!=='RESEARCH_ONLY'||!initialSummary||typeof planNext!=='function'||typeof executeRound!=='function'||!Number.isSafeInteger(maxRounds)||maxRounds<1||maxRounds>100)throw Error('invalid bounded autonomous research loop');
 const history=[],seen=new Set([initialSummary.jobId]);let summary=initialSummary;
 for(let index=0;index<maxRounds;index++){
  if(summary.ordersEnabled!==false||summary.modelUpdateApplied!==false||summary.championPromotionAllowed!==false||typeof summary.jobId!=='string')throw Error('unsafe source research summary');
  const plan=await planNext({summary,round:index+1,history:[...history]});
  if(!plan||plan.status!=='READY'||plan.researchOnly!==true||plan.ordersEnabled!==false||plan.modelUpdateAllowed!==false||plan.championPromotionAllowed!==false)return {status:'WAITING_FOR_RESEARCH_EVIDENCE',completedRounds:history.length,history,reason:plan?.reason??'NO_EXECUTABLE_PLAN',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
  const result=await executeRound({plan,sourceSummary:summary,round:index+1,confirm:'RESEARCH_ONLY'});
  if(result?.status!=='COMMITTED'||result.summary?.jobId===undefined||seen.has(result.summary.jobId)||result.summary.ordersEnabled!==false||result.summary.modelUpdateApplied!==false||result.summary.championPromotionAllowed!==false)throw Error('autonomous round lacks new immutable committed evidence');
  seen.add(result.summary.jobId);
  history.push({round:index+1,sourceJobId:summary.jobId,resultJobId:result.summary.jobId,plan});
  await onRound?.({round:index+1,summary:result.summary});
  summary=result.summary;
 }
 return {status:'BOUNDED_RESEARCH_ROUNDS_COMPLETED',completedRounds:history.length,history,lastSummary:summary,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
