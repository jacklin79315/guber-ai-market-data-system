// One explicitly authorized research-only task execution with durable lifecycle.
// Runner is injected; it must persist a diagnostic summary before COMPLETED.
import {transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
import {mapP4FollowUpToExperimentTask} from './p4-diagnostic-follow-up-experiment.mjs';
export async function executeP4DiagnosticFollowUp({store,taskId,executionJobId,atMs,confirm,runResearch}={}){
 if(confirm!=='RESEARCH_ONLY')throw Error('explicit research-only confirmation required');
 if(!store||typeof store.load!=='function'||typeof store.transition!=='function'||typeof runResearch!=='function')throw Error('missing durable research dependencies');
 const record=await store.load(taskId);
 if(!record||record.status!=='READY'||record.ordersEnabled!==false||record.modelUpdateAllowed!==false||record.championPromotionAllowed!==false)throw Error('follow-up task is not safe and READY');
 const route=mapP4FollowUpToExperimentTask(record.plan);
 if(route.status!=='EXPERIMENT_READY')return {status:'EVIDENCE_COLLECTION_REQUIRED',taskId,reason:route.reason,ordersEnabled:false};
 const running=transitionP4DiagnosticTask(record,{to:'RUNNING',atMs,executionJobId});
 await store.transition(record,running);
 try{
  const result=await runResearch({task:route.task,sourceJobId:record.sourceJobId,executionJobId,confirm:'RESEARCH_ONLY'});
  if(!result||result.status!=='COMMITTED'||result.summary?.jobId!==executionJobId||result.summary?.ordersEnabled!==false||result.summary?.modelUpdateApplied!==false||result.summary?.championPromotionAllowed!==false)throw Error('research result not durably committed or unsafe');
  const latest=await store.load(taskId);
  if(!latest||latest.status!=='RUNNING'||latest.executionJobId!==executionJobId)throw Error('task execution ownership changed');
  const completed=transitionP4DiagnosticTask(latest,{to:'COMPLETED',atMs:Math.max(Date.now(),latest.updatedAtMs+1),resultJobId:executionJobId});
  await store.transition(latest,completed);
  return {status:'COMPLETED',taskId,resultJobId:executionJobId,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 }catch(error){
  const latest=await store.load(taskId);
  if(latest?.status==='RUNNING'&&latest.executionJobId===executionJobId){
   const failed=transitionP4DiagnosticTask(latest,{to:'FAILED',atMs:Math.max(Date.now(),latest.updatedAtMs+1)});
   await store.transition(latest,failed);
  }
  throw error;
 }
}
