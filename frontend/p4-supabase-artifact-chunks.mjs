import {createHash} from 'node:crypto';
function stableJson(value){return JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)}
// Durable diagnostic artifact writer. Chunks are immutable and fenced by the research lease.
// This module does not alter the existing round checkpoint protocol.
export function createP4ArtifactChunkStore({supabaseUrl,serviceRoleKey,fetchImpl=fetch}={}){
 if(typeof supabaseUrl!=='string'||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||!serviceRoleKey||typeof fetchImpl!=='function')throw Error('invalid P4 artifact store');
 const url=new URL('/rest/v1/rpc/p4_commit_research_artifact_chunk',supabaseUrl);
 const headers={apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,Accept:'application/json','Content-Type':'application/json'};
 return {
  async read({jobId,iteration,kind,manifest}={}){
   if(!jobId||!Number.isSafeInteger(iteration)||!['CHAMPION_DIAGNOSTICS','CHALLENGER_DIAGNOSTICS','TRADE_EVIDENCE'].includes(kind)||!manifest||!Number.isSafeInteger(manifest.chunkCount)||!Number.isSafeInteger(manifest.recordCount)||!Array.isArray(manifest.chunkHashes)||manifest.chunkHashes.length!==manifest.chunkCount)throw Error('invalid P4 artifact manifest');
   const endpoint=new URL('/rest/v1/p4_research_artifact_chunks',supabaseUrl);
   endpoint.searchParams.set('job_id','eq.'+jobId);
   endpoint.searchParams.set('iteration','eq.'+iteration);
   endpoint.searchParams.set('artifact_kind','eq.'+kind);
   endpoint.searchParams.set('select','chunk_index,payload,payload_sha256');
   endpoint.searchParams.set('order','chunk_index.asc');
   endpoint.searchParams.set('limit',String(manifest.chunkCount+1));
   const response=await fetchImpl(endpoint.toString(),{method:'GET',headers,signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw Error('P4 artifact read failed: '+response.status);
   const rows=await response.json();
   if(!Array.isArray(rows)||rows.length!==manifest.chunkCount)throw Error('P4 artifact chunk count mismatch');
   const records=[];
   for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(row.chunk_index!==i||!Array.isArray(row.payload)||createHash('sha256').update(stableJson(row.payload)).digest('hex')!==row.payload_sha256||row.payload_sha256!==manifest.chunkHashes[i])throw Error('P4 artifact integrity mismatch');
    records.push(...row.payload);
   }
   if(records.length!==manifest.recordCount)throw Error('P4 artifact record count mismatch');
   return records;
  },
  async write({jobId,ownerToken,specFingerprint,iteration,kind,records,maxChunkBytes=256*1024}={}){
   if(typeof jobId!=='string'||!jobId||typeof ownerToken!=='string'||ownerToken.length<16||!Number.isSafeInteger(iteration)||iteration<1||iteration>100||typeof specFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(specFingerprint)||!['CHAMPION_DIAGNOSTICS','CHALLENGER_DIAGNOSTICS','TRADE_EVIDENCE'].includes(kind)||!Array.isArray(records)||!Number.isSafeInteger(maxChunkBytes)||maxChunkBytes<1024||maxChunkBytes>1024*1024)throw Error('invalid P4 artifact records');
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
    const hash=createHash('sha256').update(stableJson(payload)).digest('hex');
    const body=JSON.stringify({p_job_id:jobId,p_owner_token:ownerToken,p_iteration:iteration,p_spec_fingerprint:specFingerprint,p_artifact_kind:kind,p_chunk_index:index,p_payload:payload,p_payload_sha256:hash});
    let saved=false;
    for(let attempt=0;attempt<3&&!saved;attempt++){
     let response;
     try{response=await fetchImpl(url.toString(),{method:'POST',headers,body,signal:AbortSignal.timeout(60000)});}
     catch(error){if(attempt===2||!/fetch|timeout|abort|network/i.test(String(error?.message??error)))throw error;continue;}
     if(response.ok){if(await response.json()!==true)throw Error('P4 artifact chunk commit denied');saved=true;break;}
     if(![429,500,502,503,504].includes(response.status)||attempt===2)throw Error('P4 artifact chunk commit failed: '+response.status+' index='+index);
    }
   }
   return {chunkCount:chunks.length,recordCount:records.length,chunkHashes:chunks.map(payload=>createHash('sha256').update(stableJson(payload)).digest('hex'))};
  }
 };
}
