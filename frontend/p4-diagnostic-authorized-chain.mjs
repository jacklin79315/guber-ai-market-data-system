// Single bounded grant for multiple causal research rounds. Each next task is
// generated from committed evidence, not preselected independently of results.
// Only the original caller can grant this research scope; never enables orders.
import {continueP4AuthorizedResearch} from './p4-diagnostic-authorized-continuation.mjs';

export async function runP4AuthorizedDiagnosticChain({store,initialTaskId,grant,confirm,atMs,createExecutionJobId,runResearch,createTaskId,recordNextTask,loadCommittedSummary,verifyFreshEvidence}={}){
 if(confirm!=='RESEARCH_ONLY'||grant?.mode!=='RESEARCH_ONLY'||grant.ordersEnabled!==false||grant.modelUpdateAllowed!==false||grant.championPromotionAllowed!==false||!Number.isSafeInteger(grant.maxRounds)||grant.maxRounds<1||grant.maxRounds>100||grant.autoContinueProposals!==true||!Number.isSafeInteger(grant.expiresAtMs)||!Number.isSafeInteger(atMs)||atMs>=grant.expiresAtMs||typeof createExecutionJobId!=='function')throw Error('invalid bounded autonomous research grant');
 if(!Array.isArray(grant.allowedTaskIds)||!grant.allowedTaskIds.includes(initialTaskId))throw Error('initial task not authorized');
 const rounds=[],seen=new Set();
 let taskId=initialTaskId;
 for(let i=0;i<grant.maxRounds;i++){
  if(seen.has(taskId))throw Error('research cycle detected');
  seen.add(taskId);
  const now=atMs+i*2;
  if(now+1>=grant.expiresAtMs)return {status:'STOPPED_GRANT_EXPIRED',rounds,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
  const jobId=await createExecutionJobId({taskId,round:i+1});
  if(typeof jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(jobId))throw Error('invalid research job ID');
  const scopedGrant={...grant,allowedTaskIds:[taskId]};
  const result=await continueP4AuthorizedResearch({store,taskId,executionJobId:jobId,atMs:now,grant:scopedGrant,confirm,runResearch,createTaskId,recordNextTask,loadCommittedSummary,verifyFreshEvidence});
  rounds.push(result);
  if(result.status!=='COMPLETED_NEXT_RESEARCH_PROPOSED')return {status:'STOPPED_RESEARCH_GATE',rounds,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
  taskId=result.nextTaskId;
 }
 return {status:'STOPPED_MAX_ROUNDS',rounds,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
