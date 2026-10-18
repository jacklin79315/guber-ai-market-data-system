// Read immutable diagnostic evidence and create a durable, research-only follow-up task.
// Source evidence is never trusted without the summary-store integrity check.
import {createP4DiagnosticSummaryStore} from './p4-supabase-diagnostic-summaries.mjs';
import {createP4DiagnosticTaskStore} from './p4-supabase-diagnostic-tasks.mjs';
import {createP4DiagnosticTaskRecord,transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
import {mapP4FollowUpToExperimentTask} from './p4-diagnostic-follow-up-experiment.mjs';
export async function prepareP4PersistedFollowUp({confirm,sourceJobId,taskId,atMs,supabaseUrl,serviceRoleKey,fetchImpl=fetch,summaryStore,taskStore}={}){
 if(confirm!=='RESEARCH_ONLY')throw Error('explicit research-only confirmation required');
 if(!Number.isSafeInteger(atMs)||atMs<0)throw Error('invalid follow-up timestamp');
 const summaries=summaryStore??createP4DiagnosticSummaryStore({supabaseUrl,serviceRoleKey,fetchImpl});
 const tasks=taskStore??createP4DiagnosticTaskStore({supabaseUrl,serviceRoleKey,fetchImpl});
 const summary=await summaries.load(sourceJobId);
 if(!summary||summary.jobId!==sourceJobId||summary.status!=='OOS_RESEARCH_EVALUATED'||summary.oosEvidenceStatus!=='OOS_NOT_IMPROVED'||summary.learningEvidence?.assessment!=='NO_OOS_IMPROVEMENT'||summary.learningEvidence?.oosSufficient!==true||summary.ordersEnabled!==false||summary.modelUpdateApplied!==false||summary.championPromotionAllowed!==false)throw Error('source is not sufficient negative OOS research evidence');
 const plan=summary.followUpPlan;
 if(!plan||plan.sourceJobId!==sourceJobId||plan.action!=='REVISE_HYPOTHESIS'||plan.hypothesis?.evidence!=='PRIOR_OOS_NOT_IMPROVED')throw Error('missing auditable negative OOS hypothesis');
 const mapped=mapP4FollowUpToExperimentTask(plan);
 if(mapped.status!=='EXPERIMENT_READY')throw Error('negative OOS hypothesis not executable as research');
 const existing=await tasks.load(taskId);
 if(existing){if(existing.sourceJobId!==sourceJobId||JSON.stringify(existing.plan)!==JSON.stringify(plan))throw Error('follow-up task id already used for different source');return {status:existing.status,taskId,sourceJobId,record:existing,ordersEnabled:false};}
 const proposed=createP4DiagnosticTaskRecord(plan,{taskId,createdAtMs:atMs});
 await tasks.create(proposed);
 const ready=transitionP4DiagnosticTask(proposed,{to:'READY',atMs:atMs+1});
 await tasks.transition(proposed,ready);
 return {status:'READY',taskId,sourceJobId,record:ready,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
}
