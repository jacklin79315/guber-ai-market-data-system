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
 if(!checkpoint||!validId(checkpoint.jobId)||(expectedJobId!==undefined&&checkpoint.jobId!==expectedJobId)||!['LOADING','RESEARCH','STOPPED','COMPLETED','FAILED'].includes(checkpoint.phase)||!Number.isSafeInteger(checkpoint.completedWindows)||checkpoint.completedWindows<0||!Number.isSafeInteger(checkpoint.loadedCandles)||checkpoint.loadedCandles<0||!Number.isSafeInteger(checkpoint.completedIterations)||checkpoint.completedIterations<0||(checkpoint.specFingerprint!==undefined&&!/^[a-f0-9]{64}$/.test(checkpoint.specFingerprint))||!Number.isSafeInteger(checkpoint.updatedAtMs)||checkpoint.updatedAtMs<0)throw Error('invalid P4 checkpoint');
 if(checkpoint.oosReport!==undefined){const o=checkpoint.oosReport;if(!o||!['OOS_EVALUATED','OOS_INSUFFICIENT_CLOSED_TRADES','RESERVED_NOT_EVALUATED'].includes(o.validationStatus)||typeof o.independentValidation!=='boolean'||o.promotionAllowed!==false||o.metrics!==null&&(!o.metrics||!Number.isFinite(o.metrics.champion?.netRealizedPnl)||!Number.isFinite(o.metrics.selected?.netRealizedPnl)||!Number.isSafeInteger(o.metrics.champion?.closedTrades)||!Number.isSafeInteger(o.metrics.selected?.closedTrades)))throw Error('invalid P4 OOS report');}
 return true;
}
export function createP4Checkpoint({jobId,phase='LOADING',completedWindows=0,loadedCandles=0,completedIterations=0,updatedAtMs,specFingerprint,oosReport}={}){
 const checkpoint={jobId,phase,completedWindows,loadedCandles,completedIterations,updatedAtMs,...(specFingerprint?{specFingerprint}:{}),...(oosReport?{oosReport}:{})};
 validateP4Checkpoint(checkpoint);return checkpoint;
}
