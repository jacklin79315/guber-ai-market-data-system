// One-shot fixed-candidate research; immutable diagnostic summary store used as a write-once envelope.
import {runP4LockedBackend} from './p4-diagnostic-locked-backend.mjs';
import {createP4DiagnosticSummaryStore} from './p4-supabase-diagnostic-summaries.mjs';
export async function runP4LockedOneShot({env=process.env,fetchImpl=fetch,runBackend=runP4LockedBackend}={}){
 if(env.P4_RESEARCH_CONFIRM!=='RESEARCH_ONLY')throw Error('research-only confirmation required');
 const jobId=env.P4_LOCKED_JOB_ID;
 if(typeof jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(jobId))throw Error('invalid fixed candidate job ID');
 const fromOpenTime=Number(env.P4_FROM_MS),toOpenTime=Number(env.P4_TO_MS),asOfMs=Number(env.P4_AS_OF_MS);
 const sourceStart=1763503200000,sourceEnd=1770699600000;
 if(!(toOpenTime<sourceStart||fromOpenTime>sourceEnd))throw Error('evaluation overlaps source training or OOS');
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('missing server credentials');
 const store=createP4DiagnosticSummaryStore({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl});
 const existing=await store.load(jobId);
 if(existing)return {status:'ALREADY_COMMITTED',summary:existing};
 const result=await runBackend({confirm:'RESEARCH_ONLY',supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl,fromOpenTime,toOpenTime,asOfMs});
 const summary={schemaVersion:'P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1',jobId,createdAtMs:Date.now(),status:'LOCKED_CANDIDATE_RETROSPECTIVE_EVALUATED',source:result.source,sourceJobId:result.sourceJobId,lockedCandidate:result.lockedCandidate,window:result.window,loadedCandles:result.loadedCandles,feedback:result.feedback,regimeAttribution:result.comparison?.regimeAttribution??null,independentValidation:false,modelUpdateApplied:false,championPromotionAllowed:false,ordersEnabled:false};
 await store.commit(summary);
 return {status:'COMMITTED',summary:await store.load(jobId)};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 runP4LockedOneShot().then(r=>process.stdout.write(JSON.stringify({status:r.status,summary:r.summary})+'\n')).catch(e=>{process.stderr.write('locked candidate replay failed: '+e.message+'\n');process.exitCode=1});
}
