// Read-only P4 durable job status from backend Supabase; no training side effects.
// Service-role credentials must remain server-side.
export async function readP4DurableJobStatus({supabaseUrl,serviceRoleKey,jobId,fetchImpl=fetch}={}){
 if(typeof supabaseUrl!=='string'||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||typeof serviceRoleKey!=='string'||!serviceRoleKey||typeof jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(jobId))throw Error('invalid P4 status request');
 const headers={apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,Accept:'application/json'};
 const base=new URL('/rest/v1/p4_research_checkpoints',supabaseUrl);
 base.searchParams.set('job_id','eq.'+jobId);base.searchParams.set('select','job_id,checkpoint,updated_at');base.searchParams.set('limit','2');
 const response=await fetchImpl(base.toString(),{method:'GET',headers});
 if(!response.ok)throw Error('P4 checkpoint status read failed: '+response.status);
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length>1)throw Error('ambiguous P4 checkpoint status');
 if(!rows.length)return null;
 if(rows[0].job_id!==jobId)throw Error('P4 checkpoint status identity mismatch');
 const checkpoint=rows[0].checkpoint;
 if(!checkpoint||checkpoint.jobId!==jobId)throw Error('P4 checkpoint status malformed');
 const roundUrl=new URL('/rest/v1/p4_research_rounds',supabaseUrl);
 roundUrl.searchParams.set('job_id','eq.'+jobId);roundUrl.searchParams.set('select','iteration');roundUrl.searchParams.set('order','iteration.desc');roundUrl.searchParams.set('limit','1');
 const roundResponse=await fetchImpl(roundUrl.toString(),{method:'GET',headers});
 if(!roundResponse.ok)throw Error('P4 round status read failed: '+roundResponse.status);
 const roundRows=await roundResponse.json();
 if(!Array.isArray(roundRows)||roundRows.length>1)throw Error('ambiguous P4 round status');
 const durableRounds=roundRows.length?roundRows[0].iteration:0;
 if(!Number.isSafeInteger(durableRounds)||durableRounds<0)throw Error('invalid P4 durable round count');
 return {jobId,phase:checkpoint.phase,completedIterations:checkpoint.completedIterations,durableRounds,completedWindows:checkpoint.completedWindows,loadedCandles:checkpoint.loadedCandles,updatedAt:rows[0].updated_at,recoveryPending:durableRounds===checkpoint.completedIterations+1,consistencyError:durableRounds<checkpoint.completedIterations||durableRounds>checkpoint.completedIterations+1};
}
