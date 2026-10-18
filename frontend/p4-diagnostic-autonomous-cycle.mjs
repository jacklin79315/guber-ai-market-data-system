// Bounded research-only learning cycle. Never auto-authorizes a proposed task.
// A completed persisted summary determines the next research hypothesis.
import {executeP4DiagnosticFollowUp} from './p4-diagnostic-follow-up-execution.mjs';
import {planP4DiagnosticResearchFollowUp} from './p4-diagnostic-research-task-plan.mjs';
import {createP4DiagnosticTaskRecord} from './p4-diagnostic-task-lifecycle.mjs';

export async function runP4DiagnosticAutonomousCycle({store,taskId,executionJobId,atMs,confirm,runResearch,createTaskId,recordNextTask}={}){
 if(confirm!=='RESEARCH_ONLY')throw Error('research-only confirmation required');
 if(typeof createTaskId!=='function'||typeof recordNextTask!=='function'||typeof runResearch!=='function'||!store||typeof store.load!=='function')throw Error('missing autonomous cycle dependencies');
 let committedSummary=null;
 const execution=await executeP4DiagnosticFollowUp({store,taskId,executionJobId,atMs,confirm,runResearch:async args=>{
  const result=await runResearch(args);
  if(result?.status==='COMMITTED')committedSummary=result.summary;
  return result;
 }});
 if(execution.status!=='COMPLETED')return {...execution,nextTask:null,modelUpdateApplied:false,championPromotionAllowed:false};
 // Only the exact committed job may inform the next research hypothesis.
 if(!committedSummary||committedSummary.jobId!==executionJobId||committedSummary.schemaVersion!=='P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1'||committedSummary.ordersEnabled!==false||committedSummary.modelUpdateApplied!==false||committedSummary.championPromotionAllowed!==false)throw Error('completed research lacks verified diagnostic learning summary');
 const followUp=planP4DiagnosticResearchFollowUp(committedSummary);
 const nextId=await createTaskId({sourceJobId:executionJobId,plan:followUp});
 const nextRecord=createP4DiagnosticTaskRecord(followUp,{taskId:nextId,createdAtMs:Math.max(Date.now(),atMs+1)});
 await recordNextTask(nextRecord);
 return {schemaVersion:'P4_DIAGNOSTIC_AUTONOMOUS_CYCLE_V1',status:'COMPLETED_NEXT_RESEARCH_PROPOSED',completedJobId:executionJobId,nextTaskId:nextId,nextAction:followUp.action,nextTaskStatus:'PROPOSED',requiresResearchAuthorization:true,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
