// Plan a bounded follow-up from a completed research summary.
// Never executes research, updates models, or places orders.
import {decideP4DiagnosticNextAction} from './p4-diagnostic-next-action.mjs';
export function planP4DiagnosticResearchFollowUp(summary){
 const advice=decideP4DiagnosticNextAction(summary);
 if(typeof summary.jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(summary.jobId)||!Number.isSafeInteger(summary.loadedCandles)||summary.loadedCandles<1)throw Error('missing auditable diagnostic source');
 const action=advice.action;
 const kind=action==='COLLECT_MORE_TRAIN_EVIDENCE'||action==='COLLECT_MORE_UNTOUCHED_OOS_EVIDENCE'?'EXPAND_CAUSAL_EVIDENCE':action==='REVISE_HYPOTHESIS'?'INVESTIGATE_EXPERT_CAUSAL_ATTRIBUTION':action==='REQUEST_INDEPENDENT_VALIDATION'?'INDEPENDENT_VALIDATION_DESIGN':'REVIEW_MISSING_REPLAY';
 return Object.freeze({schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:summary.jobId,action,kind,reason:advice.reason,actor:summary.taskId??null,sourceCandles:summary.loadedCandles,requiresFreshNonOverlappingEvidence:action==='COLLECT_MORE_UNTOUCHED_OOS_EVIDENCE'||action==='REQUEST_INDEPENDENT_VALIDATION',status:'PROPOSED_NOT_EXECUTED',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false});
}
