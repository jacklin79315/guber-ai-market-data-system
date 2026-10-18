// Explicit research-only orchestration of durable task creation and restart recovery.
// This does not dispatch jobs or update trading models.
import {isDeepStrictEqual} from 'node:util';
import {createP4DiagnosticTaskRecord} from './p4-diagnostic-task-lifecycle.mjs';
import {recoverP4DiagnosticTask} from './p4-diagnostic-task-recovery.mjs';
export async function ensureP4DiagnosticFollowUpTask({store,summary,taskId,createdAtMs}={}){
 if(!store||typeof store.load!=='function'||typeof store.create!=='function')throw Error('missing durable P4 task store');
 const plan=summary?.followUpPlan;
 if(!plan||plan.sourceJobId!==summary.jobId||summary.ordersEnabled!==false||summary.championPromotionAllowed!==false||summary.modelUpdateApplied!==false)throw Error('unsafe or missing diagnostic follow-up');
 const proposed=createP4DiagnosticTaskRecord(plan,{taskId,createdAtMs});
 const existing=await store.load(taskId);
 if(existing){
  if(existing.sourceJobId!==proposed.sourceJobId||!isDeepStrictEqual(existing.plan,proposed.plan))throw Error('P4 follow-up task identity conflict');
  return {status:'ALREADY_EXISTS',record:existing};
 }
 await store.create(proposed);
 const persisted=await store.load(taskId);
 if(!persisted||!isDeepStrictEqual(persisted,proposed))throw Error('P4 follow-up task readback mismatch');
 return {status:'CREATED',record:persisted};
}
export async function resumeP4DiagnosticFollowUpTask({store,taskId,atMs,staleAfterMs}={}){
 return recoverP4DiagnosticTask({store,taskId,atMs,staleAfterMs});
}
