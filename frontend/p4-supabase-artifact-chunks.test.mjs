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
  const u=new URL(url),offset=Number(u.searchParams.get('offset')??0),limit=Number(u.searchParams.get('limit')??rows.length);
  return {ok:true,json:async()=>rows.slice(offset,offset+limit)};
 };
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl});
 const records=[{id:1,value:'x'.repeat(700)},{id:2,value:'y'.repeat(700)},{id:3,value:'z'.repeat(700)}];
 const manifest=await store.write({jobId:'job',ownerToken:'test-owner-token-12345',specFingerprint:hash,iteration:1,kind:'CHAMPION_DIAGNOSTICS',records,maxChunkBytes:1024});
 assert.equal(manifest.chunkCount,3);
 assert.deepEqual(await store.read({jobId:'job',iteration:1,kind:'CHAMPION_DIAGNOSTICS',manifest}),records);
 rows[0].payload=[{id:99}];
 await assert.rejects(store.read({jobId:'job',iteration:1,kind:'CHAMPION_DIAGNOSTICS',manifest}),/integrity mismatch/);
});
test('P4 archive losslessly splits and restores oversized records',async()=>{
 const rows=[];
 const fetchImpl=async(_url,opts)=>{
  if(opts.method==='POST'){
   const payload=JSON.parse(opts.body);
   rows.push({chunk_index:payload.p_chunk_index,payload:payload.p_payload,payload_sha256:payload.p_payload_sha256});
   return {ok:true,json:async()=>true};
  }
  const u=new URL(_url),offset=Number(u.searchParams.get('offset')??0),limit=Number(u.searchParams.get('limit')??rows.length);
  return {ok:true,json:async()=>rows.slice(offset,offset+limit)};
 };
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl});
 const records=[{id:1},{value:'z'.repeat(5000),nested:{reason:'long record',valid:true}},{id:3}];
 const manifest=await store.write({jobId:'job',ownerToken:'test-owner-token-12345',specFingerprint:hash,iteration:1,kind:'CHALLENGER_DIAGNOSTICS',records,maxChunkBytes:1024});
 assert.equal(manifest.fragmented,true);
 assert.ok(manifest.chunkCount>3);
 assert.deepEqual(await store.read({jobId:'job',iteration:1,kind:'CHALLENGER_DIAGNOSTICS',manifest}),records);
 rows[2].payload[0].data='corrupt';
 await assert.rejects(store.read({jobId:'job',iteration:1,kind:'CHALLENGER_DIAGNOSTICS',manifest}),/integrity mismatch/);
});
test('P4 readback rejects manifest hash mismatch',async()=>{
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl:async()=>({ok:true,json:async()=>[{chunk_index:0,payload:[{a:1}],payload_sha256:'0'.repeat(64)}]})});
 await assert.rejects(store.read({jobId:'j',iteration:1,kind:'CHAMPION_DIAGNOSTICS',manifest:{chunkCount:1,recordCount:1,chunkHashes:['f'.repeat(64)]}}),/integrity mismatch/);
});

test('P4 chunk upload resumes after partial failure without changing prior chunks',async()=>{
 const chunks=new Map();let failuresRemaining=3;
 const fetchImpl=async(_url,opts)=>{
  if(opts.method==='POST'){
   const b=JSON.parse(opts.body);
   if(b.p_chunk_index===1&&failuresRemaining>0){failuresRemaining--;return {ok:false,status:503};}
   const key=b.p_chunk_index;
   if(chunks.has(key)&&chunks.get(key).payload_sha256!==b.p_payload_sha256)return {ok:false,status:409};
   chunks.set(key,{chunk_index:key,payload:b.p_payload,payload_sha256:b.p_payload_sha256});
   return {ok:true,json:async()=>true};
  }
  return {ok:true,json:async()=>[...chunks.values()].sort((a,b)=>a.chunk_index-b.chunk_index)};
 };
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl});
 const records=[{id:1,reason:'a'.repeat(700)},{id:2,reason:'b'.repeat(700)}];
 const args={jobId:'job',ownerToken:'test-lease-token-12345',specFingerprint:hash,iteration:1,kind:'CHAMPION_DIAGNOSTICS',records,maxChunkBytes:1024};
 await assert.rejects(store.write(args),/503/);
 assert.equal(chunks.size,1);
 const manifest=await store.write(args);
 assert.equal(chunks.size,2);
 assert.deepEqual(await store.read({jobId:'job',iteration:1,kind:'CHAMPION_DIAGNOSTICS',manifest}),records);
});

test('P4 artifact retries one transient 502 and finishes upload',async()=>{
 let attempts=0;
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl:async(_url,opts)=>{
  attempts++;
  if(attempts===1)return {ok:false,status:502};
  return {ok:true,json:async()=>true};
 }});
 const result=await store.write({jobId:'job',ownerToken:'test-owner-token-12345',specFingerprint:hash,iteration:1,kind:'CHAMPION_DIAGNOSTICS',records:[{id:1}]});
 assert.equal(result.chunkCount,1);
 assert.equal(attempts,2);
});

test('P4 chunk upload retries a transient fetch failure',async()=>{
 let attempts=0;
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl:async()=>{
  attempts++;
  if(attempts===1)throw new TypeError('fetch failed');
  return {ok:true,json:async()=>true};
 }});
 const manifest=await store.write({jobId:'job',ownerToken:'test-owner-token-12345',specFingerprint:hash,iteration:1,kind:'CHAMPION_DIAGNOSTICS',records:[{id:1}]});
 assert.equal(manifest.chunkCount,1);
 assert.equal(attempts,2);
});

test('P4 artifact read paginates beyond 25 chunks without false count mismatch',async()=>{
 const rows=[];let reads=0;
 const fetchImpl=async(url,opts)=>{
  if(opts.method==='POST'){
   const b=JSON.parse(opts.body);
   rows.push({chunk_index:b.p_chunk_index,payload:b.p_payload,payload_sha256:b.p_payload_sha256});
   return {ok:true,json:async()=>true};
  }
  reads++;
  const u=new URL(url),offset=Number(u.searchParams.get('offset')),limit=Number(u.searchParams.get('limit'));
  return {ok:true,json:async()=>rows.slice(offset,offset+limit)};
 };
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl});
 const records=Array.from({length:31},(_,i)=>({id:i,reason:'x'.repeat(700)}));
 const manifest=await store.write({jobId:'job',ownerToken:'test-owner-token-12345',specFingerprint:hash,iteration:1,kind:'CHAMPION_DIAGNOSTICS',records,maxChunkBytes:1024});
 assert.equal(manifest.chunkCount,31);
 assert.deepEqual(await store.read({jobId:'job',iteration:1,kind:'CHAMPION_DIAGNOSTICS',manifest}),records);
 assert.equal(reads,2);
});

test('P4 restart reuses immutable chunks with matching hashes and restores evidence',async()=>{
 const rows=new Map();
 const fetchImpl=async(url,opts)=>{
  if(opts.method==='POST'){
   const b=JSON.parse(opts.body),key=b.p_chunk_index;
   const previous=rows.get(key);
   if(previous&&previous.payload_sha256!==b.p_payload_sha256)return {ok:false,status:409};
   if(!previous)rows.set(key,{chunk_index:key,payload:b.p_payload,payload_sha256:b.p_payload_sha256});
   return {ok:true,json:async()=>true};
  }
  const u=new URL(url),offset=Number(u.searchParams.get('offset')),limit=Number(u.searchParams.get('limit'));
  return {ok:true,json:async()=>[...rows.values()].sort((a,b)=>a.chunk_index-b.chunk_index).slice(offset,offset+limit)};
 };
 const store=createP4ArtifactChunkStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',fetchImpl});
 const records=[{id:1,value:'z'.repeat(5000)},{id:2,detail:'x'.repeat(700)}];
 const args={jobId:'restart',ownerToken:'test-owner-token-12345',specFingerprint:hash,iteration:1,kind:'CHAMPION_DIAGNOSTICS',records,maxChunkBytes:1024};
 const first=await store.write(args),count=rows.size;
 const replay=await store.write(args);
 assert.deepEqual(replay,first);
 assert.equal(rows.size,count);
 assert.deepEqual(await store.read({jobId:'restart',iteration:1,kind:'CHAMPION_DIAGNOSTICS',manifest:replay}),records);
 await assert.rejects(store.write({...args,records:[{id:1,value:'different'}]}),/409/);
});
