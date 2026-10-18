// Connect an authorized diagnostic research chain to the existing persisted
// Supabase historical runner. Research windows are caller-supplied and bounded.
import {runP4AuthorizedDiagnosticChain} from './p4-diagnostic-authorized-chain.mjs';
import {runP4PersistedDiagnosticResearch} from './p4-diagnostic-persisted-run.mjs';
import {proposeP4DiagnosticExperimentArms} from './p4-diagnostic-experiment-candidates.mjs';
import {createP4DiagnosticTaskStore} from './p4-supabase-diagnostic-tasks.mjs';
import {createP4DiagnosticSummaryStore} from './p4-supabase-diagnostic-summaries.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
import {researchRuleBrain} from './p3-research-rule-brain.mjs';

export async function runP4DiagnosticBackendChain({supabaseUrl,serviceRoleKey,fetchImpl=fetch,initialTaskId,grant,confirm,atMs,windows,createExecutionJobId,createTaskId,parentParameters=DEFAULT_TRAINING_PARAMETERS,brain=researchRuleBrain,costs={feeRate:0.001,slippageRate:0},maxArms=2,explorationSteps=[1],validationFraction=0.35,priorResearchJobIds=[],runPersisted=runP4PersistedDiagnosticResearch,taskStore,summaryStore}={}){
 if(!Array.isArray(windows)||windows.length!==grant?.maxRounds||windows.some(w=>w?.symbol!=='BTCUSDT'||w?.timeframe!=='1h'||!Number.isSafeInteger(w.fromOpenTime)||!Number.isSafeInteger(w.toOpenTime)||!Number.isSafeInteger(w.asOfMs)))throw Error('each research round requires explicit historical bounds');
 const hour=3600000;
 for(let i=0;i<windows.length;i++){
  const w=windows[i];
  if(w.fromOpenTime<0||w.fromOpenTime%hour!==0||w.toOpenTime%hour!==0||w.toOpenTime<w.fromOpenTime+129*hour||w.toOpenTime>w.fromOpenTime+1999*hour||w.asOfMs<=w.toOpenTime+hour-1)throw Error('invalid historical evidence bounds');
  for(let j=0;j<i;j++){
   const previous=windows[j];
   if(w.fromOpenTime<=previous.toOpenTime&&previous.fromOpenTime<=w.toOpenTime)throw Error('overlapping historical research windows');
  }
 }
 // Prevent backtests from evaluating candles beyond the declared research cutoff.
 if(windows.some(w=>w.asOfMs>Date.now()))throw Error('future historical cutoff is not permitted');
 if(!Array.isArray(priorResearchJobIds)||priorResearchJobIds.length>50||new Set(priorResearchJobIds).size!==priorResearchJobIds.length||priorResearchJobIds.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id)))throw Error('invalid prior research evidence IDs');
 const store=taskStore??createP4DiagnosticTaskStore({supabaseUrl,serviceRoleKey,fetchImpl});
 const summaries=summaryStore??createP4DiagnosticSummaryStore({supabaseUrl,serviceRoleKey,fetchImpl});
 const priorSummaries=await Promise.all(priorResearchJobIds.map(id=>summaries.load(id)));
 if(priorSummaries.some((s,i)=>!s||s.jobId!==priorResearchJobIds[i]||s.schemaVersion!=='P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1'||s.ordersEnabled!==false||s.modelUpdateApplied!==false||s.championPromotionAllowed!==false||!Array.isArray(s.trainingResults)))throw Error('missing or unsafe prior research evidence');
 let round=0;
 return runP4AuthorizedDiagnosticChain({store,initialTaskId,grant,confirm,atMs,createExecutionJobId,createTaskId,recordNextTask:r=>store.create(r),loadCommittedSummary:id=>summaries.load(id),runResearch:async({task,executionJobId,confirm:researchConfirm})=>{
  const window=windows[round++];
  if(!window)throw Error('missing authorized research window');
  if(task?.id!=='COLLECT_ENTRY_CAUSAL_EVIDENCE'&&task?.id!=='COLLECT_REWARD_CAUSAL_EVIDENCE')throw Error('invalid mapped diagnostic expert task');
  const mapped={task};
  const prior=[...priorSummaries];
  const seen=new Set();
  for(const s of prior)for(const item of s.trainingResults){
   const arm=item?.arm,feedback=item?.feedback;
   if(s.taskId===mapped.task.id&&arm&&feedback?.improvedInSameWindow===false&&Number.isFinite(arm.from)&&Math.abs(arm.from-parentParameters[arm.parameter])<1e-9)seen.add(arm.parameter+':'+arm.direction);
  }
  const excludedDirections=[...seen].map(key=>{const [parameter,direction]=key.split(':');return {parameter,direction:Number(direction)}});
  // The latest OOS failure is a stronger restriction than same-window training evidence.
  // Include it even when the preceding training result improved.
  if(mapped.task.avoidPriorFailedDirection){
   const failed=mapped.task.avoidPriorFailedDirection;
   if(Math.abs(parentParameters[failed.parameter]-failed.failedFrom)<1e-9&&!excludedDirections.some(x=>x.parameter===failed.parameter&&x.direction===failed.avoidDirection))excludedDirections.push({parameter:failed.parameter,direction:failed.avoidDirection});
  }
  const proposed=proposeP4DiagnosticExperimentArms({task:mapped.task,parentParameters,maxArms,explorationSteps,excludedDirections});
  if(proposed.arms.length===0){
   // A completed hypothesis search is a valid research outcome, not a runner crash.
   // Do not create a fake experiment or mutate the model merely to continue.
   return {status:'NO_UNTESTED_DIAGNOSTIC_ARMS',researchOnly:true,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,taskId:mapped.task.id,excludedDirections};
  }
  if(mapped.task.avoidPriorFailedDirection&&proposed.arms.some(arm=>arm.parameter===mapped.task.avoidPriorFailedDirection.parameter&&arm.direction===mapped.task.avoidPriorFailedDirection.avoidDirection))throw Error('previous failed hypothesis must not be repeated');
  const effectiveExplorationSteps=explorationSteps;
  return runPersisted({confirm:researchConfirm,researchJobId:executionJobId,supabaseUrl,serviceRoleKey,fetchImpl,summaryStore:summaries,...window,task:mapped.task,parentParameters,brain,costs,maxArms,explorationSteps:effectiveExplorationSteps,excludedDirections,validationFraction});
 }});
}
