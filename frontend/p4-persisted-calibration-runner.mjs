// Execute an existing Win calibration contract on verified persisted P4 artifacts.
// No parameter search, model mutation, champion promotion or orders.
import {evaluateP4PersistedWinCalibration} from './p4-persisted-win-calibration.mjs';
export async function runP4PersistedCalibrationResearch({confirm,contract,sourceJobId,iteration,manifest,artifactStore,summaryStore,createdAtMs=Date.now()}={}){
 if(confirm!=='RESEARCH_ONLY'||contract?.kind!=='WIN_PROBABILITY_CALIBRATION'||contract?.mode!=='RESEARCH_ONLY'||contract?.ordersEnabled!==false||contract?.championPromotionAllowed!==false||contract?.modelUpdateApplied!==false)throw Error('calibration requires a research-only contract');
 if(typeof sourceJobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(sourceJobId)||!Number.isSafeInteger(iteration)||iteration<1||!manifest||typeof artifactStore?.read!=='function'||typeof summaryStore?.load!=='function'||typeof summaryStore?.commit!=='function'||!Number.isSafeInteger(createdAtMs))throw Error('invalid persisted calibration dependencies');
 // Reuse the contract job ID only for this immutable research result.
 const jobId=contract.jobId;
 const existing=await summaryStore.load(jobId);
 if(existing){
  if(existing.sourceJobId!==sourceJobId||existing.sourceIteration!==iteration||existing.contractFingerprint!==contract.fingerprint||existing.sourceManifest!==JSON.stringify(manifest))throw Error('immutable calibration job ID conflicts with source or contract');
  return {status:'ALREADY_COMMITTED',summary:existing,ordersEnabled:false};
 }
 const records=await artifactStore.read({jobId:sourceJobId,iteration,kind:'CHAMPION_DIAGNOSTICS',manifest});
 const result=evaluateP4PersistedWinCalibration({records,contract});
 const summary={schemaVersion:'P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1',jobId,createdAtMs,status:result.status,sourceJobId,sourceIteration:iteration,sourceManifest:JSON.stringify(manifest),contractFingerprint:contract.fingerprint,calibration:result,mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,independentValidation:false};
 await summaryStore.commit(summary);
 const persisted=await summaryStore.load(jobId);
 if(!persisted||persisted.contractFingerprint!==contract.fingerprint||persisted.sourceJobId!==sourceJobId)throw Error('calibration research not durably committed');
 return {status:'COMMITTED',summary:persisted,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
