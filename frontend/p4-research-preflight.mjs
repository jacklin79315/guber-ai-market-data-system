// Read-only database preflight for manually triggered P4 research.
import {parseP4RunnerOptions} from './p4-backend-runner.mjs';
export async function preflightP4Research({env=process.env,fetchImpl=fetch}={}){
 const config=parseP4RunnerOptions(env);
 const supabaseUrl=env.SUPABASE_URL,key=env.SUPABASE_SERVICE_ROLE_KEY;
 if(typeof supabaseUrl!=='string'||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||!key)throw Error('P4 Supabase credentials missing or malformed');
 const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
 for(const table of ['raw_candles','market_features','p4_research_checkpoints','p4_research_rounds','p4_research_leases','p4_research_artifact_chunks']){
  const u=new URL('/rest/v1/'+table,supabaseUrl);
  u.searchParams.set('select',table==='raw_candles'?'open_time':table==='market_features'?'close_time':table==='p4_research_leases'?'job_id':'job_id');
  u.searchParams.set('limit','1');
  const response=await fetchImpl(u.toString(),{method:'GET',headers});
  if(!response.ok)throw Error('P4 preflight '+table+' read failed: '+response.status);
  if(!Array.isArray(await response.json()))throw Error('P4 preflight '+table+' malformed response');
 }
 return {ready:true,jobId:config.jobId,expectedCandles:config.expectedCandles,iterations:config.iterations,liveTrading:false};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 preflightP4Research().then(x=>process.stdout.write(JSON.stringify(x)+'\n')).catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1});
}
