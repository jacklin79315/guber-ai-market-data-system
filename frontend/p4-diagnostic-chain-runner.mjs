// Explicitly dispatched research-only entrypoint; no order placement or model promotion.
import {runP4DiagnosticBackendChain} from './p4-diagnostic-backend-chain.mjs';
import {createP4DiagnosticTaskStore} from './p4-supabase-diagnostic-tasks.mjs';
import {createP4DiagnosticSummaryStore} from './p4-supabase-diagnostic-summaries.mjs';
import {planP4DiagnosticResearchFollowUp} from './p4-diagnostic-research-task-plan.mjs';
import {createP4DiagnosticTaskRecord} from './p4-diagnostic-task-lifecycle.mjs';
export function parseP4ChainOptions(env=process.env,now=Date.now()){
 if(env.P4_RESEARCH_CONFIRM!=='RESEARCH_ONLY'||env.P4_ORDERS_ENABLED!=='false'||env.P4_MODEL_UPDATE_ALLOWED!=='false'||env.P4_CHAMPION_PROMOTION_ALLOWED!=='false')throw Error('explicit research-only safety flags required');
 const id=env.P4_INITIAL_TASK_ID, prefix=env.P4_CHAIN_ID;
 const sourceJobId=env.P4_SOURCE_SUMMARY_JOB_ID||null;
 if(sourceJobId!==null&&!/^[A-Za-z0-9_-]{1,100}$/.test(sourceJobId))throw Error('invalid source research summary');
 if(!/^[A-Za-z0-9_-]{1,50}$/.test(id??'')||!/^[A-Za-z0-9_-]{1,70}$/.test(prefix??''))throw Error('invalid chain or initial task identity');
 const raw=JSON.parse(env.P4_WINDOWS_JSON??'null');
 if(!Array.isArray(raw)||raw.length<1||raw.length>2)throw Error('chain requires one or two explicitly selected historical windows');
 const windows=raw.map(w=>({symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:w.fromOpenTime,toOpenTime:w.toOpenTime,asOfMs:w.asOfMs}));
 if(!Number.isSafeInteger(now)||now<0)throw Error('invalid current time');
 return {initialTaskId:id,sourceJobId,prefix,windows,atMs:now,grant:{mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false,autoContinueProposals:true,maxRounds:windows.length,expiresAtMs:now+85*60000,allowedTaskIds:[id]}};
}
export async function runP4DiagnosticChainFromEnv({env=process.env,now=Date.now(),runner=runP4DiagnosticBackendChain}={}){
 const config=parseP4ChainOptions(env,now);
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Supabase server credentials missing');
 if(config.sourceJobId){
  const summaries=createP4DiagnosticSummaryStore({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
  const tasks=createP4DiagnosticTaskStore({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
  const summary=await summaries.load(config.sourceJobId);
  if(!summary||summary.schemaVersion!=='P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1'||summary.taskId!=='COLLECT_ENTRY_CAUSAL_EVIDENCE'&&summary.taskId!=='COLLECT_REWARD_CAUSAL_EVIDENCE')throw Error('source summary is missing a valid diagnostic expert');
  const plan={...planP4DiagnosticResearchFollowUp(summary),actor:summary.taskId};
  if(plan.requiresFreshNonOverlappingEvidence||!['REVISE_HYPOTHESIS','COLLECT_MORE_TRAIN_EVIDENCE'].includes(plan.action))throw Error('source summary requires independent evidence rather than automatic research');
  const existing=await tasks.load(config.initialTaskId);
  if(existing&&existing.sourceJobId!==config.sourceJobId)throw Error('task identity conflicts with source summary');
  if(!existing)await tasks.create(createP4DiagnosticTaskRecord(plan,{taskId:config.initialTaskId,createdAtMs:now-1}));
 }
 return runner({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY,confirm:'RESEARCH_ONLY',initialTaskId:config.initialTaskId,atMs:config.atMs,grant:config.grant,windows:config.windows,createExecutionJobId:async({round})=>config.prefix+'_job_'+round,createTaskId:async({sourceJobId})=>config.prefix+'_next_'+sourceJobId.slice(-35)});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 runP4DiagnosticChainFromEnv().then(result=>process.stdout.write(JSON.stringify({status:result.status,rounds:result.rounds?.map(r=>({status:r.status,resultJobId:r.completedJobId??null,nextAction:r.nextAction??null})),ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false})+'\n')).catch(error=>{process.stderr.write('P4 chain failed: '+error.message+'\n');process.exitCode=1});
}
