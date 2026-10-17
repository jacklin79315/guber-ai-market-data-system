// Server-side P4 research round persistence; never expose serviceRoleKey in a browser.
export function createP4SupabaseRoundStore({supabaseUrl,serviceRoleKey,fetchImpl=fetch}={}){
 if(typeof supabaseUrl!=='string'||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||typeof serviceRoleKey!=='string'||!serviceRoleKey||typeof fetchImpl!=='function')throw Error('invalid P4 round storage configuration');
 const endpoint=new URL('/rest/v1/p4_research_rounds',supabaseUrl);
 const headers={apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,Accept:'application/json','Content-Type':'application/json'};
 const request=async(url,options)=>{const response=await fetchImpl(url.toString(),options);if(!response.ok)throw Error('P4 round storage request failed: '+response.status);return response};
 return {
  async load(jobId,specFingerprint){
   const url=new URL(endpoint);url.searchParams.set('job_id','eq.'+jobId);url.searchParams.set('select','iteration,spec_fingerprint,round_result');url.searchParams.set('order','iteration.asc');url.searchParams.set('limit','101');
   const rows=await (await request(url,{method:'GET',headers})).json();
   if(!Array.isArray(rows))throw Error('invalid P4 round storage response');
   return rows.map((row,i)=>{if(row.iteration!==i+1||row.spec_fingerprint!==specFingerprint||!row.round_result||row.round_result.iteration!==row.iteration)throw Error('P4 persisted round integrity mismatch');return structuredClone(row.round_result)});
  },
  async commitLeased(jobId,ownerToken,specFingerprint,round){
   if(typeof ownerToken!=='string'||ownerToken.length<16||!round||!Number.isSafeInteger(round.iteration)||round.iteration<1||round.iteration>100)throw Error('invalid P4 fenced round commit');
   const rpc=new URL('/rest/v1/rpc/p4_commit_research_round',supabaseUrl);
   const response=await request(rpc,{method:'POST',headers,body:JSON.stringify({p_job_id:jobId,p_owner_token:ownerToken,p_iteration:round.iteration,p_spec_fingerprint:specFingerprint,p_round_result:round})});
   if(await response.json()!==true)throw Error('P4 fenced round commit denied');
  },
  async commit(jobId,specFingerprint,round){
   if(!round||!Number.isSafeInteger(round.iteration)||round.iteration<1||round.iteration>100)throw Error('invalid P4 committed round');
   // No upsert: duplicate iteration is an error and must not silently replace history.
   await request(endpoint,{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({job_id:jobId,iteration:round.iteration,spec_fingerprint:specFingerprint,round_result:round})});
  }
 };
}
