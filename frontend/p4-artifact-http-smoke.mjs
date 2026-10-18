// Isolated HTTP smoke test for P4 artifact persistence; no research or live orders.
import {randomBytes,createHash} from 'node:crypto';
import {createP4SupabaseLeaseStore} from './p4-supabase-leases.mjs';
import {createP4ArtifactChunkStore} from './p4-supabase-artifact-chunks.mjs';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('P4 smoke requires configured Supabase secrets');
const token=randomBytes(24).toString('hex');
const jobId='p4_artifact_http_smoke_'+Date.now()+'_'+randomBytes(3).toString('hex');
const fingerprint=createHash('sha256').update('P4_HTTP_ARTIFACT_SMOKE_V1').digest('hex');
const leases=createP4SupabaseLeaseStore({supabaseUrl:url,serviceRoleKey:key});
const chunks=createP4ArtifactChunkStore({supabaseUrl:url,serviceRoleKey:key});
const records=Array.from({length:12},(_,i)=>({sequence:i,decision:i%2?'WAIT':'APPROVE',reason:'http-smoke-'+String(i).padStart(3,'0')+'x'.repeat(700)}));
let claimed=false;
try{
 claimed=await leases.claim(jobId,token,300);
 if(!claimed)throw Error('P4 smoke lease claim denied');
 const args={jobId,ownerToken:token,specFingerprint:fingerprint,iteration:1,kind:'CHAMPION_DIAGNOSTICS',records,maxChunkBytes:2048};
 const manifest=await chunks.write(args);
 if(manifest.chunkCount<2)throw Error('P4 smoke expected multiple chunks');
 const second=await chunks.write(args);
 if(JSON.stringify(manifest)!==JSON.stringify(second))throw Error('P4 smoke idempotency mismatch');
 const restored=await chunks.read({jobId,iteration:1,kind:args.kind,manifest});
 if(JSON.stringify(restored)!==JSON.stringify(records))throw Error('P4 smoke roundtrip mismatch');
 process.stdout.write(JSON.stringify({status:'PASS',chunkCount:manifest.chunkCount,recordCount:manifest.recordCount,jobId})+'\n');
}finally{
 if(claimed){const released=await leases.release(jobId,token);if(!released)process.stderr.write('P4 smoke lease release unconfirmed\n');}
}
