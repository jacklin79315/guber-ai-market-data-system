// Execute a bounded batch of independently READY research tasks.
// A generated PROPOSED task is never auto-authorized or executed.
import {runP4DiagnosticAutonomousCycle} from './p4-diagnostic-autonomous-cycle.mjs';

export async function runP4DiagnosticResearchBatch({store,authorizedTasks,confirm,runResearch,createTaskId,recordNextTask,loadCommittedSummary}={}){
 if(confirm!=='RESEARCH_ONLY'||!Array.isArray(authorizedTasks)||authorizedTasks.length<1||authorizedTasks.length>100||!store||typeof store.load!=='function')throw Error('invalid bounded research batch');
 const ids=new Set(),jobs=new Set(),rounds=[];
 for(const item of authorizedTasks){
  if(!item||typeof item.taskId!=='string'||typeof item.executionJobId!=='string'||!Number.isSafeInteger(item.atMs)||ids.has(item.taskId)||jobs.has(item.executionJobId))throw Error('invalid or duplicate authorized research identity');
  ids.add(item.taskId);jobs.add(item.executionJobId);
 }
 for(const item of authorizedTasks){
  const record=await store.load(item.taskId);
  if(record?.status!=='READY'||record.ordersEnabled!==false||record.modelUpdateAllowed!==false||record.championPromotionAllowed!==false)throw Error('batch task is not explicitly READY');
  const result=await runP4DiagnosticAutonomousCycle({store,taskId:item.taskId,executionJobId:item.executionJobId,atMs:item.atMs,confirm,runResearch,createTaskId,recordNextTask,loadCommittedSummary});
  rounds.push(result);
  if(result.status!=='COMPLETED_NEXT_RESEARCH_PROPOSED')break;
 }
 return {schemaVersion:'P4_DIAGNOSTIC_RESEARCH_BATCH_V1',status:'BATCH_FINISHED',executed:rounds.length,rounds,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
