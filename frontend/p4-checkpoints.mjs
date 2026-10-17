// P4 durable checkpoint contract: caller provides a persistence adapter (database or file).
// Checkpoints are research metadata, never authority to promote or place live orders.
const clone=x=>structuredClone(x);
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
export function createP4CheckpointStore({read,write}={}){
 if(typeof read!=='function'||typeof write!=='function')throw Error('P4 checkpoint storage adapter required');
 return {
  async load(jobId){
   if(!validId(jobId))throw Error('invalid P4 job identity');
   const data=await read(jobId);
   if(data==null)return null;
   validateP4Checkpoint(data,jobId);
   return clone(data);
  },
  async save(checkpoint){
   validateP4Checkpoint(checkpoint);
   // Persistence adapter must atomically replace by jobId; no in-memory durability claim.
   await write(checkpoint.jobId,clone(checkpoint));
   return clone(checkpoint);
  }
 };
}
export function validateP4Checkpoint(checkpoint,expectedJobId){
 if(!checkpoint||!validId(checkpoint.jobId)||(expectedJobId!==undefined&&checkpoint.jobId!==expectedJobId)||!['LOADING','RESEARCH','STOPPED','COMPLETED','FAILED'].includes(checkpoint.phase)||!Number.isSafeInteger(checkpoint.completedWindows)||checkpoint.completedWindows<0||!Number.isSafeInteger(checkpoint.loadedCandles)||checkpoint.loadedCandles<0||!Number.isSafeInteger(checkpoint.completedIterations)||checkpoint.completedIterations<0||!Number.isSafeInteger(checkpoint.updatedAtMs)||checkpoint.updatedAtMs<0)throw Error('invalid P4 checkpoint');
 return true;
}
export function createP4Checkpoint({jobId,phase='LOADING',completedWindows=0,loadedCandles=0,completedIterations=0,updatedAtMs}={}){
 const checkpoint={jobId,phase,completedWindows,loadedCandles,completedIterations,updatedAtMs};
 validateP4Checkpoint(checkpoint);return checkpoint;
}
