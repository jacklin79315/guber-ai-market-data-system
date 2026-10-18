// Server-only restart-safe task recovery. Never starts replay or places orders.
import {transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
export async function recoverP4DiagnosticTask({store,taskId,atMs,staleAfterMs=3600000}={}){
 if(!store||typeof store.load!=='function'||typeof store.transition!=='function'||!Number.isSafeInteger(atMs)||atMs<0||!Number.isSafeInteger(staleAfterMs)||staleAfterMs<1)throw Error('invalid task recovery controls');
 const record=await store.load(taskId);
 if(!record)return {status:'NOT_FOUND',record:null};
 if(record.ordersEnabled!==false||record.modelUpdateAllowed!==false||record.championPromotionAllowed!==false)throw Error('unsafe persisted task');
 if(record.status==='RUNNING'){
  if(!Number.isSafeInteger(record.updatedAtMs)||atMs-record.updatedAtMs<staleAfterMs)return {status:'ACTIVE_NOT_RECOVERED',record};
  const failed=transitionP4DiagnosticTask(record,{to:'FAILED',atMs});
  await store.transition(record,failed);
  return {status:'STALE_MARKED_FAILED',record:failed};
 }
 if(record.status==='FAILED'){
  const ready=transitionP4DiagnosticTask(record,{to:'READY',atMs});
  await store.transition(record,ready);
  return {status:'REQUEUED',record:ready};
 }
 return {status:'UNCHANGED',record};
}
