import {createP4CheckpointStore,validateP4Checkpoint} from './p4-checkpoints.mjs';
// Server-only Supabase persistence. Requires a privileged backend key and applied migration.
// Never import or invoke this adapter in the browser.
export function createP4SupabaseCheckpointStore({supabaseUrl,serviceRoleKey,fetchImpl=fetch}={}){
 if(typeof supabaseUrl!=='string'||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||typeof serviceRoleKey!=='string'||!serviceRoleKey||typeof fetchImpl!=='function')throw Error('invalid P4 server checkpoint configuration');
 const endpoint=new URL('/rest/v1/p4_research_checkpoints',supabaseUrl);
 const headers={apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,Accept:'application/json','Content-Type':'application/json'};
 const store=createP4CheckpointStore({
  read:async jobId=>{
   const url=new URL(endpoint);url.searchParams.set('job_id','eq.'+jobId);url.searchParams.set('select','job_id,checkpoint');url.searchParams.set('limit','2');
   const response=await fetchImpl(url.toString(),{method:'GET',headers});
   if(!response.ok)throw Error('P4 checkpoint read failed: '+response.status);
   const rows=await response.json();
   if(!Array.isArray(rows)||rows.length>1)throw Error('P4 checkpoint read ambiguous');
   if(!rows.length)return null;
   if(rows[0].job_id!==jobId)throw Error('P4 checkpoint identity mismatch');
   return rows[0].checkpoint;
  },
  write:async(jobId,checkpoint)=>{
   const url=new URL(endpoint);url.searchParams.set('on_conflict','job_id');
   const response=await fetchImpl(url.toString(),{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({job_id:jobId,checkpoint})});
   if(!response.ok)throw Error('P4 checkpoint write failed: '+response.status);
  }
 });
 return {...store,async saveLeased(checkpoint,ownerToken){validateP4Checkpoint(checkpoint);if(typeof ownerToken!=='string'||ownerToken.length<16)throw Error('invalid P4 lease owner');const url=new URL('/rest/v1/rpc/p4_save_leased_checkpoint',supabaseUrl);const response=await fetchImpl(url.toString(),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_job_id:checkpoint.jobId,p_owner_token:ownerToken,p_checkpoint:checkpoint})});if(!response.ok)throw Error('P4 fenced checkpoint failed: '+response.status);if(await response.json()!==true)throw Error('P4 fenced checkpoint denied');return structuredClone(checkpoint)}};
}
