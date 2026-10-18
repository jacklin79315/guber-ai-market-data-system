// Connect an authorized diagnostic research chain to the existing persisted
// Supabase historical runner. Research windows are caller-supplied and bounded.
import {runP4AuthorizedDiagnosticChain} from './p4-diagnostic-authorized-chain.mjs';
import {runP4PersistedDiagnosticResearch} from './p4-diagnostic-persisted-run.mjs';
import {mapP4FollowUpToExperimentTask} from './p4-diagnostic-follow-up-experiment.mjs';
import {createP4DiagnosticTaskStore} from './p4-supabase-diagnostic-tasks.mjs';
import {createP4DiagnosticSummaryStore} from './p4-supabase-diagnostic-summaries.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
import {researchRuleBrain} from './p3-research-rule-brain.mjs';

export async function runP4DiagnosticBackendChain({supabaseUrl,serviceRoleKey,fetchImpl=fetch,initialTaskId,grant,confirm,atMs,windows,createExecutionJobId,createTaskId,parentParameters=DEFAULT_TRAINING_PARAMETERS,brain=researchRuleBrain,costs={feeRate:0.001,slippageRate:0},maxArms=2,explorationSteps=[1],validationFraction=0.35,runPersisted=runP4PersistedDiagnosticResearch,taskStore,summaryStore}={}){
 if(!Array.isArray(windows)||windows.length!==grant?.maxRounds||windows.some(w=>w?.symbol!=='BTCUSDT'||w?.timeframe!=='1h'||!Number.isSafeInteger(w.fromOpenTime)||!Number.isSafeInteger(w.toOpenTime)||!Number.isSafeInteger(w.asOfMs)))throw Error('each research round requires explicit historical bounds');
 const store=taskStore??createP4DiagnosticTaskStore({supabaseUrl,serviceRoleKey,fetchImpl});
 const summaries=summaryStore??createP4DiagnosticSummaryStore({supabaseUrl,serviceRoleKey,fetchImpl});
 let round=0;
 return runP4AuthorizedDiagnosticChain({store,initialTaskId,grant,confirm,atMs,createExecutionJobId,createTaskId,recordNextTask:r=>store.create(r),loadCommittedSummary:id=>summaries.load(id),runResearch:async({task,executionJobId,confirm:researchConfirm})=>{
  const window=windows[round++];
  if(!window)throw Error('missing authorized research window');
  const mapped=mapP4FollowUpToExperimentTask({schemaVersion:'P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1',sourceJobId:task.sourceJobId,actor:task.id,action:'COLLECT_MORE_TRAIN_EVIDENCE',researchOnly:true,autoExecutionAuthorized:false,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false});
  if(mapped.status!=='EXPERIMENT_READY')throw Error('no executable causal research task');
  return runPersisted({confirm:researchConfirm,researchJobId:executionJobId,supabaseUrl,serviceRoleKey,fetchImpl,summaryStore:summaries,...window,task,parentParameters,brain,costs,maxArms,explorationSteps,validationFraction});
 }});
}
