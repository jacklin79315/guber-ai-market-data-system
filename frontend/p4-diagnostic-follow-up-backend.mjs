// Connect durable follow-up lifecycle to the existing Supabase-backed diagnostic replay.
// Caller must explicitly supply historical bounds and research-only confirmation.
import {mapP4FollowUpToExperimentTask} from './p4-diagnostic-follow-up-experiment.mjs';
import {proposeP4DiagnosticExperimentArms} from './p4-diagnostic-experiment-candidates.mjs';
import {executeP4DiagnosticFollowUp} from './p4-diagnostic-follow-up-execution.mjs';
import {runP4PersistedDiagnosticResearch} from './p4-diagnostic-persisted-run.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
import {researchRuleBrain} from './p3-research-rule-brain.mjs';
export async function runP4DiagnosticFollowUpBackend({store,taskId,executionJobId,atMs,confirm,supabaseUrl,serviceRoleKey,fetchImpl=fetch,symbol='BTCUSDT',timeframe='1h',fromOpenTime,toOpenTime,asOfMs,parentParameters=DEFAULT_TRAINING_PARAMETERS,brain=researchRuleBrain,costs={feeRate:0.001,slippageRate:0},maxArms=2,explorationSteps=[1],validationFraction=0.35,runPersisted=runP4PersistedDiagnosticResearch}={}){
 if(confirm!=='RESEARCH_ONLY')throw Error('explicit research-only confirmation required');
 const step=3600000;
 if(typeof runPersisted!=='function'||!Number.isSafeInteger(fromOpenTime)||!Number.isSafeInteger(toOpenTime)||!Number.isSafeInteger(asOfMs)||fromOpenTime<0||fromOpenTime%step!==0||toOpenTime%step!==0||toOpenTime<fromOpenTime+129*step||toOpenTime>fromOpenTime+1999*step||asOfMs<=toOpenTime+step-1||symbol!=='BTCUSDT'||timeframe!=='1h'||!Number.isSafeInteger(maxArms)||maxArms<1||maxArms>6||!Number.isFinite(validationFraction)||validationFraction<0.2||validationFraction>0.45)throw Error('invalid bounded historical follow-up');
 const sourceRecord=await store?.load?.(taskId);
 if(!sourceRecord||sourceRecord.status!=='READY')throw Error('follow-up task must be READY');
 const mapped=mapP4FollowUpToExperimentTask(sourceRecord.plan);
 if(mapped.status==='EXPERIMENT_READY'){
  const proposal=proposeP4DiagnosticExperimentArms({task:mapped.task,parentParameters,maxArms,explorationSteps});
  if(sourceRecord.plan.action==='REVISE_HYPOTHESIS'&&sourceRecord.plan.hypothesis&&proposal.arms.some(arm=>arm.parameter===sourceRecord.plan.hypothesis.parameter&&arm.direction===sourceRecord.plan.hypothesis.avoidDirection))throw Error('previous failed hypothesis was not excluded');
 }
 return executeP4DiagnosticFollowUp({store,taskId,executionJobId,atMs,confirm,runResearch:async({task,executionJobId:jobId,confirm:researchConfirm})=>{
  return runPersisted({confirm:researchConfirm,researchJobId:jobId,supabaseUrl,serviceRoleKey,fetchImpl,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,task,parentParameters,brain,costs,maxArms,explorationSteps,validationFraction});
 }});
}
