import test from 'node:test';
import assert from 'node:assert/strict';
import {createP4ArtifactChunkStore} from './p4-supabase-artifact-chunks.mjs';
const hash='a'.repeat(64);
test('P4 artifact chunks are written, read back and verified',async()=>{
 const rows=[];const fetchImpl=async(url,opts)=>{
  if(opts.method==='POST'){
   const b=JSON.parse(opts.body);
   rows.push({chunk_index:b.p_chunk_index,payload:JSON.parse(JSON.stringify(b.p_payload,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)),payload_sha256:b.p_payload_sha256});
   return {ok:true,json:async()=>true};
  }
  return {ok:true,json:async()=>rows};
 };
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl});
 const records=[{id:1,value:'x'.repeat(700)},{id:2,value:'y'.repeat(700)},{id:3,value:'z'.repeat(700)}];
 const manifest=await store.write({jobId:'job',ownerToken:'token',specFingerprint:hash,iteration:1,kind:'CHAMPION_DIAGNOSTICS',records,maxChunkBytes:1024});
 assert.equal(manifest.chunkCount,3);
 assert.deepEqual(await store.read({jobId:'job',iteration:1,kind:'CHAMPION_DIAGNOSTICS',manifest}),records);
 rows[0].payload=[{id:99}];
 await assert.rejects(store.read({jobId:'job',iteration:1,kind:'CHAMPION_DIAGNOSTICS',manifest}),/integrity mismatch/);
});
test('P4 archive rejects oversized indivisible records',async()=>{
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl:async()=>{throw Error('must not send')}});
 await assert.rejects(store.write({jobId:'job',ownerToken:'token',specFingerprint:hash,iteration:1,kind:'CHALLENGER_DIAGNOSTICS',records:[{value:'z'.repeat(2048)}],maxChunkBytes:1024}),/exceeds chunk size/);
});

test('P4 readback rejects manifest hash mismatch',async()=>{
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl:async()=>({ok:true,json:async()=>[{chunk_index:0,payload:[{a:1}],payload_sha256:'0'.repeat(64)}]})});
 await assert.rejects(store.read({jobId:'j',iteration:1,kind:'CHAMPION_DIAGNOSTICS',manifest:{chunkCount:1,recordCount:1,chunkHashes:['f'.repeat(64)]}}),/integrity mismatch/);
});
