// Bounded research-only learning cycle. Never auto-authorizes a proposed task.
// A completed persisted summary determines the next research hypothesis.
import {executeP4DiagnosticFollowUp} from './p4-diagnostic-follow-up-execution.mjs';
import {planP4DiagnosticResearchFollowUp} from './p4-diagnostic-research-task-plan.mjs';
import {createP4DiagnosticTaskRecord} from './p4-diagnostic-task-lifecycle.mjs';

export async function runP4DiagnosticAutonomousCycle({store,taskId,executionJobId,atMs,confirm,runResearch,createTaskId,recordNextTask,loadCommittedSummary}={}){
 if(confirm!=='RESEARCH_ONLY')throw Error('research-only confirmation required');
 if(typeof createTaskId!=='function'||typeof recordNextTask!=='function'||typeof runResearch!=='function'||!store||typeof store.load!=='function')throw Error('missing autonomous cycle dependencies');
 let committedSummary=null;
 // The task may already be COMPLETED after a worker crash; recover its immutable
 // research summary without replaying the historical experiment.
 const prior=await store.load(taskId);
 if(prior?.status==='COMPLETED'){
  if(typeof loadCommittedSummary!=='function')return {schemaVersion:'P4_DIAGNOSTIC_AUTONOMOUS_CYCLE_V1',status:'ALREADY_COMPLETED_REQUIRES_RECOVERY',completedJobId:prior.resultJobId,nextTask:null,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
  const recovered=await loadCommittedSummary(prior.resultJobId);
  if(recovered?.jobId!==prior.resultJobId||recovered.schemaVersion!=='P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1'||recovered.ordersEnabled!==false||recovered.modelUpdateApplied!==false||recovered.championPromotionAllowed!==false)throw Error('unsafe or missing committed recovery summary');
  const nextPlan=planP4DiagnosticResearchFollowUp(recovered);
  if(nextPlan.requiresFreshNonOverlappingEvidence)return {schemaVersion:'P4_DIAGNOSTIC_AUTONOMOUS_CYCLE_V1',status:'COMPLETED_AWAITING_INDEPENDENT_EVIDENCE',completedJobId:prior.resultJobId,nextAction:nextPlan.action,nextPlan,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
  const nextId=await createTaskId({sourceJobId:prior.resultJobId,plan:nextPlan});
  const nextRecord=createP4DiagnosticTaskRecord(nextPlan,{taskId:nextId,createdAtMs:Math.max(Date.now(),atMs??0)});
  await recordNextTask(nextRecord);
  return {schemaVersion:'P4_DIAGNOSTIC_AUTONOMOUS_CYCLE_V1',status:'COMPLETED_RECOVERED_NEXT_TASK_PROPOSED',completedJobId:prior.resultJobId,nextAction:nextPlan.action,nextTaskId:nextId,nextTaskStatus:'PROPOSED',requiresResearchAuthorization:true,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 }
 const execution=await executeP4DiagnosticFollowUp({store,taskId,executionJobId,atMs,confirm,runResearch:async args=>{
  const result=await runResearch(args);
  if(result?.status==='COMMITTED')committedSummary=result.summary;
  return result;
 }});
 if(execution.status!=='COMPLETED')return {...execution,nextTask:null,modelUpdateApplied:false,championPromotionAllowed:false};
 // Only the exact committed job may inform the next research hypothesis.
 if(!committedSummary||committedSummary.jobId!==executionJobId||committedSummary.schemaVersion!=='P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1'||committedSummary.ordersEnabled!==false||committedSummary.modelUpdateApplied!==false||committedSummary.championPromotionAllowed!==false)throw Error('completed research lacks verified diagnostic learning summary');
 const followUp=planP4DiagnosticResearchFollowUp(committedSummary);
 if(followUp.action==='REQUEST_INDEPENDENT_VALIDATION'||followUp.action==='COLLECT_MORE_UNTOUCHED_OOS_EVIDENCE')return {schemaVersion:'P4_DIAGNOSTIC_AUTONOMOUS_CYCLE_V1',status:'COMPLETED_AWAITING_INDEPENDENT_EVIDENCE',completedJobId:executionJobId,nextAction:followUp.action,nextTask:null,requiresResearchAuthorization:true,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 const nextId=await createTaskId({sourceJobId:executionJobId,plan:followUp});
 const nextRecord=createP4DiagnosticTaskRecord(followUp,{taskId:nextId,createdAtMs:Math.max(Date.now(),atMs+1)});
 await recordNextTask(nextRecord);
 return {schemaVersion:'P4_DIAGNOSTIC_AUTONOMOUS_CYCLE_V1',status:'COMPLETED_NEXT_RESEARCH_PROPOSED',completedJobId:executionJobId,nextTaskId:nextId,nextAction:followUp.action,nextTaskStatus:'PROPOSED',requiresResearchAuthorization:true,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
