// Connect an authorized diagnostic research chain to the existing persisted
// Supabase historical runner. Research windows are caller-supplied and bounded.
import {runP4AuthorizedDiagnosticChain} from './p4-diagnostic-authorized-chain.mjs';
import {runP4PersistedDiagnosticResearch} from './p4-diagnostic-persisted-run.mjs';
import {proposeP4DiagnosticExperimentArms} from './p4-diagnostic-experiment-candidates.mjs';
import {mapP4FollowUpToExperimentTask} from './p4-diagnostic-follow-up-experiment.mjs';
import {createP4DiagnosticTaskStore} from './p4-supabase-diagnostic-tasks.mjs';
import {createP4DiagnosticSummaryStore} from './p4-supabase-diagnostic-summaries.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
import {researchRuleBrain} from './p3-research-rule-brain.mjs';

export async function runP4DiagnosticBackendChain({supabaseUrl,serviceRoleKey,fetchImpl=fetch,initialTaskId,grant,confirm,atMs,windows,createExecutionJobId,createTaskId,parentParameters=DEFAULT_TRAINING_PARAMETERS,brain=researchRuleBrain,costs={feeRate:0.001,slippageRate:0},maxArms=2,explorationSteps=[1],validationFraction=0.35,runPersisted=runP4PersistedDiagnosticResearch,taskStore,summaryStore}={}){
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
 const store=taskStore??createP4DiagnosticTaskStore({supabaseUrl,serviceRoleKey,fetchImpl});
 const summaries=summaryStore??createP4DiagnosticSummaryStore({supabaseUrl,serviceRoleKey,fetchImpl});
 let round=0;
 return runP4AuthorizedDiagnosticChain({store,initialTaskId,grant,confirm,atMs,createExecutionJobId,createTaskId,recordNextTask:r=>store.create(r),loadCommittedSummary:id=>summaries.load(id),runResearch:async({task,executionJobId,confirm:researchConfirm})=>{
  const window=windows[round++];
  if(!window)throw Error('missing authorized research window');
  const mapped=mapP4FollowUpToExperimentTask(task.plan);
  if(mapped.status!=='EXPERIMENT_READY')throw Error('follow-up does not permit an experiment');
  const proposed=proposeP4DiagnosticExperimentArms({task:mapped.task,parentParameters,maxArms,explorationSteps});
  if(mapped.task.avoidPriorFailedDirection&&proposed.arms.some(arm=>arm.parameter===mapped.task.avoidPriorFailedDirection.parameter&&arm.direction===mapped.task.avoidPriorFailedDirection.avoidDirection))throw Error('previous failed hypothesis must not be repeated');
  return runPersisted({confirm:researchConfirm,researchJobId:executionJobId,supabaseUrl,serviceRoleKey,fetchImpl,summaryStore:summaries,...window,task:mapped.task,parentParameters,brain,costs,maxArms,explorationSteps,validationFraction});
 }});
}
