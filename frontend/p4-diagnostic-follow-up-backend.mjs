// Connect durable follow-up lifecycle to the existing Supabase-backed diagnostic replay.
// Caller must explicitly supply historical bounds and research-only confirmation.
import {executeP4DiagnosticFollowUp} from './p4-diagnostic-follow-up-execution.mjs';
import {runP4PersistedDiagnosticResearch} from './p4-diagnostic-persisted-run.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
import {researchRuleBrain} from './p3-research-rule-brain.mjs';
export async function runP4DiagnosticFollowUpBackend({store,taskId,executionJobId,atMs,confirm,supabaseUrl,serviceRoleKey,fetchImpl=fetch,symbol='BTCUSDT',timeframe='1h',fromOpenTime,toOpenTime,asOfMs,parentParameters=DEFAULT_TRAINING_PARAMETERS,brain=researchRuleBrain,costs={feeRate:0.001,slippageRate:0},maxArms=2,runPersisted=runP4PersistedDiagnosticResearch}={}){
 if(confirm!=='RESEARCH_ONLY')throw Error('explicit research-only confirmation required');
 if(typeof runPersisted!=='function'||!Number.isSafeInteger(fromOpenTime)||!Number.isSafeInteger(toOpenTime)||!Number.isSafeInteger(asOfMs)||fromOpenTime<0||toOpenTime<=fromOpenTime||asOfMs<=toOpenTime||symbol!=='BTCUSDT'||timeframe!=='1h'||!Number.isSafeInteger(maxArms)||maxArms<1||maxArms>6)throw Error('invalid bounded historical follow-up');
 return executeP4DiagnosticFollowUp({store,taskId,executionJobId,atMs,confirm,runResearch:async({task,executionJobId:jobId,confirm:researchConfirm})=>{
  return runPersisted({confirm:researchConfirm,researchJobId:jobId,supabaseUrl,serviceRoleKey,fetchImpl,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,task,parentParameters,brain,costs,maxArms});
 }});
}
