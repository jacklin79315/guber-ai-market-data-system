// Explicit, bounded research grant permits a diagnostic-generated proposal to
// become READY. No grant can authorize trading, model updates or promotion.
import {transitionP4DiagnosticTask} from './p4-diagnostic-task-lifecycle.mjs';
import {mapP4FollowUpToExperimentTask} from './p4-diagnostic-follow-up-experiment.mjs';
import {runP4DiagnosticAutonomousCycle} from './p4-diagnostic-autonomous-cycle.mjs';

export async function continueP4AuthorizedResearch({store,taskId,executionJobId,atMs,grant,confirm,runResearch,createTaskId,recordNextTask,loadCommittedSummary,verifyFreshEvidence}={}){
 if(confirm!=='RESEARCH_ONLY'||grant?.mode!=='RESEARCH_ONLY'||grant.ordersEnabled!==false||grant.modelUpdateAllowed!==false||grant.championPromotionAllowed!==false||!Array.isArray(grant.allowedTaskIds)||!grant.allowedTaskIds.includes(taskId)||!Number.isSafeInteger(grant.expiresAtMs)||!Number.isSafeInteger(atMs)||atMs>=grant.expiresAtMs)throw Error('missing bounded research authorization');
 if(typeof store?.load!=='function'||typeof store?.transition!=='function')throw Error('missing durable task store');
 const record=await store.load(taskId);
 if(record?.status!=='PROPOSED'||record.ordersEnabled!==false||record.modelUpdateAllowed!==false||record.championPromotionAllowed!==false)throw Error('research proposal is not safe');
 const route=mapP4FollowUpToExperimentTask(record.plan);
 if(route.status!=='EXPERIMENT_READY')return {schemaVersion:'P4_DIAGNOSTIC_AUTONOMOUS_CYCLE_V1',status:'EVIDENCE_COLLECTION_REQUIRED',taskId,reason:route.reason,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 if(record.plan?.requiresFreshNonOverlappingEvidence){
  if(typeof verifyFreshEvidence!=='function'||await verifyFreshEvidence(record.plan)!==true)throw Error('independent evidence verification required');
 }
 const ready=transitionP4DiagnosticTask(record,{to:'READY',atMs});
 await store.transition(record,ready);
 return runP4DiagnosticAutonomousCycle({store,taskId,executionJobId,atMs:atMs+1,confirm,runResearch,createTaskId,recordNextTask,loadCommittedSummary});
}
