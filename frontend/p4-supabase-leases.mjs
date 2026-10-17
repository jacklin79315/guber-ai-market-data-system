// Server-only P4 job lease adapter. Lease duration is bounded by database RPC.
export function createP4SupabaseLeaseStore({supabaseUrl,serviceRoleKey,fetchImpl=fetch}={}){
 if(typeof supabaseUrl!=='string'||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||typeof serviceRoleKey!=='string'||!serviceRoleKey||typeof fetchImpl!=='function')throw Error('invalid P4 lease configuration');
 const base=new URL('/rest/v1/rpc/',supabaseUrl);
 const headers={apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,Accept:'application/json','Content-Type':'application/json'};
 const invoke=async(name,payload)=>{
  const response=await fetchImpl(new URL(name,base).toString(),{method:'POST',headers,body:JSON.stringify(payload)});
  if(!response.ok)throw Error('P4 lease '+name+' failed: '+response.status);
  const value=await response.json();
  if(typeof value!=='boolean')throw Error('P4 lease RPC returned invalid result');
  return value;
 };
 return {
  claim:(jobId,ownerToken,seconds=900)=>invoke('p4_claim_research_lease',{p_job_id:jobId,p_owner_token:ownerToken,p_seconds:seconds}),
  renew:(jobId,ownerToken,seconds=900)=>invoke('p4_renew_research_lease',{p_job_id:jobId,p_owner_token:ownerToken,p_seconds:seconds}),
  release:(jobId,ownerToken)=>invoke('p4_release_research_lease',{p_job_id:jobId,p_owner_token:ownerToken})
 };
}
