// Connect persisted diagnostic follow-up advice to existing historical experiment engine.
// No execution without an explicit research-only caller and replay inputs.
import {runP4DiagnosticExperiments} from './p4-diagnostic-experiment-runner.mjs';
export function mapP4FollowUpToExperimentTask(plan,{actor,sampleCount=30}={}){
 if(!plan||plan.schemaVersion!=='P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1'||plan.researchOnly!==true||plan.autoExecutionAuthorized!==false||plan.ordersEnabled!==false||plan.modelUpdateAllowed!==false||plan.championPromotionAllowed!==false||typeof plan.sourceJobId!=='string'||!Number.isSafeInteger(sampleCount)||sampleCount<0)throw Error('unsafe P4 follow-up');
 if(plan.action!=='REVISE_HYPOTHESIS'&&plan.action!=='COLLECT_MORE_TRAIN_EVIDENCE')return {status:'EVIDENCE_COLLECTION_REQUIRED',task:null,reason:plan.action};
 const derived=plan.actor==='COLLECT_ENTRY_CAUSAL_EVIDENCE'?'Entry':plan.actor==='COLLECT_REWARD_CAUSAL_EVIDENCE'?'Reward':null;
 if(!derived||actor!==undefined&&actor!==derived)throw Error('missing or conflicting diagnostic actor');
 actor=derived;
 const h=plan.hypothesis;
 const owned=actor==='Entry'?['entryLookback','entryThreshold']:['rewardAtrPeriod','rewardStopAtr','rewardTakeAtr'];
 if(h!==null&&h!==undefined&&(!owned.includes(h.parameter)||!Number.isFinite(h.failedFrom)||!Number.isFinite(h.failedTo)||h.avoidDirection!==Math.sign(h.failedTo-h.failedFrom)||![1,-1].includes(h.avoidDirection)||h.evidence!=='PRIOR_OOS_NOT_IMPROVED'))throw Error('invalid diagnostic parameter hypothesis');
 return {status:'EXPERIMENT_READY',task:{id:'COLLECT_'+actor.toUpperCase()+'_CAUSAL_EVIDENCE',actor,priority:'MEDIUM',sampleCount,sourceJobId:plan.sourceJobId,avoidPriorFailedDirection:h??null},reason:plan.reason};
}
export async function runP4FollowUpExperiment({plan,actor,sampleCount=30,confirm,parentParameters,...replayInputs}={}){
 if(confirm!=='RESEARCH_ONLY')throw Error('explicit research-only confirmation required');
 const mapped=mapP4FollowUpToExperimentTask(plan,{actor,sampleCount});
 if(mapped.status!=='EXPERIMENT_READY')return {...mapped,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 const result=await runP4DiagnosticExperiments({task:mapped.task,parentParameters,...replayInputs});
 return {status:'EXPERIMENT_COMPLETED_RESEARCH_ONLY',sourceJobId:plan.sourceJobId,result,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
