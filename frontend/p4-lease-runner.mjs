// P4 backend-only lease boundary for durable historical research.
// A failed renewal invalidates the local worker and stops further rounds.
export async function runP4WithLease({leaseStore,jobId,ownerToken,leaseSeconds=900,run}={}){
 if(!leaseStore||typeof leaseStore.claim!=='function'||typeof leaseStore.renew!=='function'||typeof leaseStore.release!=='function'||typeof run!=='function'||typeof jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(jobId)||typeof ownerToken!=='string'||ownerToken.length<16||ownerToken.length>128)throw Error('invalid P4 lease execution');
 if(!await leaseStore.claim(jobId,ownerToken,leaseSeconds))throw Error('P4 research job is already leased');
 let lost=false;
 const ensureLease=async()=>{if(lost)throw Error('P4 research lease lost');try{if(!await leaseStore.renew(jobId,ownerToken,leaseSeconds))throw Error('P4 research lease lost')}catch(e){lost=true;throw e}};
 try{return await run({ensureLease,isLeaseLost:()=>lost})}
 finally{try{await leaseStore.release(jobId,ownerToken)}catch(e){if(!lost)throw e}}
}
