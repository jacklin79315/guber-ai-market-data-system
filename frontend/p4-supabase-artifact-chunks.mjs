import {createHash} from 'node:crypto';
// Durable diagnostic artifact writer. Chunks are immutable and fenced by the research lease.
// This module does not alter the existing round checkpoint protocol.
export function createP4ArtifactChunkStore({supabaseUrl,serviceRoleKey,fetchImpl=fetch}={}){
 if(typeof supabaseUrl!=='string'||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||!serviceRoleKey||typeof fetchImpl!=='function')throw Error('invalid P4 artifact store');
 const url=new URL('/rest/v1/rpc/p4_commit_research_artifact_chunk',supabaseUrl);
 const headers={apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,Accept:'application/json','Content-Type':'application/json'};
 return {
  async write({jobId,ownerToken,specFingerprint,iteration,kind,records,maxChunkBytes=256*1024}={}){
   if(!['CHAMPION_DIAGNOSTICS','CHALLENGER_DIAGNOSTICS','TRADE_EVIDENCE'].includes(kind)||!Array.isArray(records)||!Number.isSafeInteger(maxChunkBytes)||maxChunkBytes<1024||maxChunkBytes>1024*1024)throw Error('invalid P4 artifact records');
   const chunks=[];let current=[],bytes=2;
   for(const record of records){
    const encoded=JSON.stringify(record);
    if(encoded===undefined)throw Error('invalid P4 artifact record');
    const size=Buffer.byteLength(encoded,'utf8')+(current.length?1:0);
    if(size+2>maxChunkBytes)throw Error('P4 artifact record exceeds chunk size');
    if(current.length&&bytes+size>maxChunkBytes){chunks.push(current);current=[];bytes=2;}
    current.push(record);bytes+=Buffer.byteLength(encoded,'utf8')+(current.length>1?1:0);
   }
   if(current.length)chunks.push(current);
   for(let index=0;index<chunks.length;index++){
    const payload=chunks[index];
    const hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const body=JSON.stringify({p_job_id:jobId,p_owner_token:ownerToken,p_iteration:iteration,p_spec_fingerprint:specFingerprint,p_artifact_kind:kind,p_chunk_index:index,p_payload:payload,p_payload_sha256:hash});
    const response=await fetchImpl(url.toString(),{method:'POST',headers,body,signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw Error('P4 artifact chunk commit failed: '+response.status+' index='+index);
    if(await response.json()!==true)throw Error('P4 artifact chunk commit denied');
   }
   return {chunkCount:chunks.length,recordCount:records.length};
  }
 };
}
