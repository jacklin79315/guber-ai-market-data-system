import {createHash} from 'node:crypto';
// Read-only audit of already persisted P4 chunks. No lease, writes or deletion.
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('missing Supabase credentials');
const jobId='p4_btc_24m_accept_20261018',kind='CHAMPION_DIAGNOSTICS';
const stableJson=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
let index=0,fragmentParts=0,fragments=0,records=0;
while(true){
 const endpoint=new URL('/rest/v1/p4_research_artifact_chunks',url);
 for(const [k,v] of Object.entries({job_id:'eq.'+jobId,iteration:'eq.1',artifact_kind:'eq.'+kind,select:'chunk_index,payload,payload_sha256',order:'chunk_index.asc',limit:'10',offset:String(index)}))endpoint.searchParams.set(k,v);
 const response=await fetch(endpoint,{headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('audit HTTP '+response.status+' at '+index);
 const batch=await response.json();
 if(!Array.isArray(batch))throw Error('audit response not array');
 for(const row of batch){
  if(row.chunk_index!==index)throw Error('non-contiguous chunk '+index);
  if(!Array.isArray(row.payload))throw Error('invalid payload '+index);
  const hash=createHash('sha256').update(stableJson(row.payload)).digest('hex');
  if(hash!==row.payload_sha256)throw Error('SHA256 mismatch at '+index);
  for(const record of row.payload){
   if(record?.__p4_fragment_v1===true){fragmentParts++;if(record.part===0)fragments++;}
   else records++;
  }
  index++;
 }
 if(batch.length<10)break;
}
if(index!==254)throw Error('expected 254 existing chunks, got '+index);
process.stdout.write(JSON.stringify({status:'PASS',jobId,kind,chunks:index,verifiedHashes:index,standaloneRecords:records,fragmentGroups:fragments,fragmentParts})+'\n');
