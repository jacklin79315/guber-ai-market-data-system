// Explicitly invoked one-shot research, never part of the web server or live trading.
// Reads integrity-checked OOS evidence, prepares durable task, then replays a disjoint historical window.
import {prepareP4PersistedFollowUp} from './p4-diagnostic-follow-up-source.mjs';
import {createP4DiagnosticTaskStore} from './p4-supabase-diagnostic-tasks.mjs';
import {runP4DiagnosticFollowUpBackend} from './p4-diagnostic-follow-up-backend.mjs';
export async function runP4DiagnosticOneShot({env=process.env,fetchImpl=fetch,prepare=prepareP4PersistedFollowUp,runBackend=runP4DiagnosticFollowUpBackend}={}){
 if(env.P4_RESEARCH_CONFIRM!=='RESEARCH_ONLY')throw Error('explicit research-only confirmation required');
 const sourceJobId=env.P4_SOURCE_JOB_ID,taskId=env.P4_FOLLOWUP_TASK_ID,executionJobId=env.P4_FOLLOWUP_EXECUTION_ID;
 if(![sourceJobId,taskId,executionJobId].every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x))||new Set([sourceJobId,taskId,executionJobId]).size!==3)throw Error('invalid unique follow-up IDs');
 const fromOpenTime=Number(env.P4_FROM_MS),toOpenTime=Number(env.P4_TO_MS),asOfMs=Number(env.P4_AS_OF_MS);
 const step=3600000;
 if(![fromOpenTime,toOpenTime,asOfMs].every(Number.isSafeInteger)||fromOpenTime<0||fromOpenTime%step!==0||toOpenTime%step!==0||toOpenTime<fromOpenTime+129*step||toOpenTime>fromOpenTime+1999*step||asOfMs<=toOpenTime+step-1)throw Error('invalid historical follow-up window');
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('missing server credentials');
 const store=createP4DiagnosticTaskStore({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl});
 const prepared=await prepare({confirm:'RESEARCH_ONLY',sourceJobId,taskId,atMs:Date.now(),supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl,taskStore:store});
 if(prepared.status==='COMPLETED')return {status:'ALREADY_COMPLETED',taskId,ordersEnabled:false};
 if(prepared.status!=='READY')throw Error('follow-up not READY: '+prepared.status);
 const sourceWindow=env.P4_SOURCE_WINDOW_END_MS===undefined?null:Number(env.P4_SOURCE_WINDOW_END_MS);
 if(!Number.isSafeInteger(sourceWindow)||sourceWindow<0||toOpenTime>=sourceWindow)throw Error('follow-up window must end strictly before prior evaluated window');
 const explorationSteps=env.P4_EXPLORATION_STEPS?env.P4_EXPLORATION_STEPS.split(',').map(Number):[1];
 const result=await runBackend({store,taskId,executionJobId,atMs:Date.now(),confirm:'RESEARCH_ONLY',supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl,fromOpenTime,toOpenTime,asOfMs,validationFraction:0.35,maxArms:6,explorationSteps});
 return {...result,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 runP4DiagnosticOneShot().then(r=>process.stdout.write(JSON.stringify(r)+'\n')).catch(e=>{process.stderr.write('P4 one-shot follow-up failed: '+e.message+'\n');process.exitCode=1});
}
