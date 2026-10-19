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
   const rows=[];
   for(let offset=0;offset<manifest.chunkCount;offset+=5){
    const page=new URL(endpoint);
    page.searchParams.set('limit',String(Math.min(5,manifest.chunkCount-offset)));
    page.searchParams.set('offset',String(offset));
    let response;
    for(let attempt=0;attempt<3;attempt++){
     try{response=await fetchImpl(page.toString(),{method:'GET',headers,signal:AbortSignal.timeout(60000)});}
     catch(error){if(attempt===2||!/fetch|timeout|abort|network/i.test(String(error?.message??error)))throw error;continue;}
     if(response.ok)break;
     if(attempt===2||![429,500,502,503,504].includes(response.status))throw Error('P4 artifact read failed: '+response.status+' offset='+offset);
    }
    const batch=await response.json();
    if(!Array.isArray(batch)||batch.length!==Math.min(25,manifest.chunkCount-offset))throw Error('P4 artifact chunk count mismatch');
    rows.push(...batch);
   }
   if(rows.length!==manifest.chunkCount)throw Error('P4 artifact chunk count mismatch');
   const records=[];
   for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(row.chunk_index!==i||!Array.isArray(row.payload)||createHash('sha256').update(stableJson(row.payload)).digest('hex')!==row.payload_sha256||row.payload_sha256!==manifest.chunkHashes[i])throw Error('P4 artifact integrity mismatch');
    records.push(...row.payload);
   }
   const reconstructed=[];
   for(let i=0;i<records.length;i++){
    const item=records[i];
    if(item&&item.__p4_fragment_v1===true){
     if(manifest.fragmented!==true||item.part!==0||!Number.isSafeInteger(item.total)||item.total<1||item.total>100000)throw Error('P4 artifact fragment integrity mismatch');
     let json='';
     for(let j=0;j<item.total;j++){
      const part=records[i+j];
      if(!part||part.__p4_fragment_v1!==true||part.part!==j||part.total!==item.total||typeof part.data!=='string')throw Error('P4 artifact fragment integrity mismatch');
      json+=part.data;
     }
     try{reconstructed.push(JSON.parse(json));}catch{throw Error('P4 artifact fragment JSON integrity mismatch');}
     i+=item.total-1;
    }else reconstructed.push(item);
   }
   if(reconstructed.length!==manifest.recordCount)throw Error('P4 artifact record count mismatch');
   return reconstructed;
  },
  async write({jobId,ownerToken,specFingerprint,iteration,kind,records,maxChunkBytes=256*1024}={}){
   if(typeof jobId!=='string'||!jobId||typeof ownerToken!=='string'||ownerToken.length<16||!Number.isSafeInteger(iteration)||iteration<1||iteration>100||typeof specFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(specFingerprint)||!['CHAMPION_DIAGNOSTICS','CHALLENGER_DIAGNOSTICS','TRADE_EVIDENCE'].includes(kind)||!Array.isArray(records)||!Number.isSafeInteger(maxChunkBytes)||maxChunkBytes<1024||maxChunkBytes>1024*1024)throw Error('invalid P4 artifact records');
   const chunks=[];let current=[],bytes=2,fragmented=false;
   for(const record of records){
    const encoded=JSON.stringify(record);
    if(encoded===undefined)throw Error('invalid P4 artifact record');
    const size=Buffer.byteLength(encoded,'utf8')+(current.length?1:0);
    if(size+2>maxChunkBytes){
     fragmented=true;
     if(current.length){chunks.push(current);current=[];bytes=2;}
     const parts=[];let offset=0;
     while(offset<encoded.length){
      let low=1,high=Math.min(encoded.length-offset,maxChunkBytes),take=0;
      while(low<=high){
       const mid=Math.floor((low+high)/2);
       const probe={__p4_fragment_v1:true,part:parts.length,total:999999,data:encoded.slice(offset,offset+mid)};
       if(Buffer.byteLength(JSON.stringify([probe]),'utf8')<=maxChunkBytes){take=mid;low=mid+1;}else high=mid-1;
      }
      if(!take)throw Error('P4 artifact fragment budget too small');
      parts.push(encoded.slice(offset,offset+take));offset+=take;
     }
     for(let i=0;i<parts.length;i++)chunks.push([{__p4_fragment_v1:true,part:i,total:parts.length,data:parts[i]}]);
     continue;
    }
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
   return {fragmented,chunkCount:chunks.length,recordCount:records.length,chunkHashes:chunks.map(payload=>createHash('sha256').update(stableJson(payload)).digest('hex'))};
  }
 };
}
