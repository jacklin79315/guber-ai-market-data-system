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
   const payload=JSON.stringify({p_job_id:jobId,p_owner_token:ownerToken,p_iteration:round.iteration,p_spec_fingerprint:specFingerprint,p_round_result:round});
   const payloadBytes=Buffer.byteLength(payload,'utf8');
   process.stderr.write(JSON.stringify({phase:'P4_ROUND_COMMIT_DIAGNOSTIC',jobId,iteration:round.iteration,payloadBytes,payloadMiB:Number((payloadBytes/1048576).toFixed(2)),ledgerRuns:round.ledgerSnapshot?.runs?.length??null})+'\n');
   for(let attempt=0;attempt<3;attempt++){
    try{
     const startedAt=Date.now();
     const response=await request(rpc,{method:'POST',headers,body:payload,signal:AbortSignal.timeout(60000)});
     process.stderr.write(JSON.stringify({phase:'P4_ROUND_COMMIT_RESPONSE',iteration:round.iteration,attempt:attempt+1,elapsedMs:Date.now()-startedAt,payloadBytes})+'\n');
     if(await response.json()!==true)throw Error('P4 fenced round commit denied');
     return;
    }catch(e){
     // A 502 or lost connection can occur AFTER the transaction commits.
     // Confirm persistence before attempting the same fenced write again.
     if(!/failed: (?:429|502|503|504|520|521|522|523|524)|fetch failed|timeout|abort/i.test(e.message))throw e;
     try{
      const existing=await this.load(jobId,specFingerprint);
      const committed=existing.find(x=>x.iteration===round.iteration);
      if(committed){
       if(JSON.stringify(committed)!==JSON.stringify(round))throw Error('P4 round commit conflict: persisted content differs');
       return;
      }
     }catch(readError){
      if(/integrity mismatch|commit conflict/.test(readError.message))throw readError;
      if(attempt===2)throw Error('P4 round commit unconfirmed after transient failure: '+e.message,{cause:readError});
     }
     if(attempt===2)throw e;
     await new Promise(resolve=>setTimeout(resolve,750*(2**attempt)));
    }
   }
  },
  async commit(jobId,specFingerprint,round){
   if(!round||!Number.isSafeInteger(round.iteration)||round.iteration<1||round.iteration>100)throw Error('invalid P4 committed round');
   // No upsert: duplicate iteration is an error and must not silently replace history.
   await request(endpoint,{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({job_id:jobId,iteration:round.iteration,spec_fingerprint:specFingerprint,round_result:round})});
  }
 };
}
