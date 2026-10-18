// P4 backend-only lease boundary for durable historical research.
// A failed renewal invalidates the local worker and stops further rounds.
export async function runP4WithLease({leaseStore,jobId,ownerToken,leaseSeconds=900,heartbeatMs,run}={}){
 if(!leaseStore||typeof leaseStore.claim!=='function'||typeof leaseStore.renew!=='function'||typeof leaseStore.release!=='function'||typeof run!=='function'||typeof jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(jobId)||typeof ownerToken!=='string'||ownerToken.length<16||ownerToken.length>128)throw Error('invalid P4 lease execution');
 if(!Number.isSafeInteger(leaseSeconds)||leaseSeconds<30||leaseSeconds>3600||heartbeatMs!==undefined&&(!Number.isSafeInteger(heartbeatMs)||heartbeatMs<1000||heartbeatMs>=leaseSeconds*1000/2))throw Error('invalid P4 lease heartbeat configuration');
 if(!await leaseStore.claim(jobId,ownerToken,leaseSeconds))throw Error('P4 research job is already leased');
 let lost=false,heartbeatError=null,renewing=null;
 const intervalMs=heartbeatMs??Math.max(1000,Math.floor(leaseSeconds*1000/3));
 const ensureLease=async()=>{if(lost)throw heartbeatError??Error('P4 research lease lost');if(renewing)return renewing;renewing=(async()=>{try{if(!await leaseStore.renew(jobId,ownerToken,leaseSeconds))throw Error('P4 research lease lost')}catch(e){lost=true;heartbeatError=e;throw e}finally{renewing=null}})();return renewing};
 const timer=setInterval(()=>{void ensureLease().catch(()=>{})},intervalMs);
 timer.unref?.();
 let primaryError=null;
 try{const result=await run({ensureLease,isLeaseLost:()=>lost});if(lost)throw heartbeatError??Error('P4 research lease lost');return result}
 catch(e){primaryError=e;throw e}
 finally{
  clearInterval(timer);
  if(renewing)await renewing.catch(()=>{});
  try{await leaseStore.release(jobId,ownerToken)}
  catch(e){
   if(primaryError){primaryError.cleanupError=e;process.emitWarning('P4 lease cleanup also failed: '+e.message)}
   else if(!lost)throw e;
  }
 }
}
