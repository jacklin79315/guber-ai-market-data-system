function deepEqualArtifact(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();return ak.length===bk.length&&ak.every((key,i)=>key===bk[i]&&deepEqualArtifact(a[key],b[key]));}
import {reconcileP4ResearchProgress} from './p4-progress-reconcile.mjs';
import {auditP4ClosedEvidence} from './p4-closed-evidence-audit.mjs';
import {runP4WithLease} from './p4-lease-runner.mjs';
import {fingerprintP4JobSpec,assertP4CheckpointCompatible} from './p4-job-spec.mjs';
import {createP4Checkpoint} from './p4-checkpoints.mjs';
import {loadP4SegmentedHistoricalCandles} from './p4-segmented-reader.mjs';
import {createSupabaseFeatureAtDecision} from './p3-supabase-feature-reader.mjs';
import {runP4ResearchCycle} from './p4-research-cycle.mjs';
import {runP4PartitionedResearchCycle} from './p4-partitioned-research-cycle.mjs';
// Offline P4 orchestration. Data must be fully verified before any research iteration.
// This is not a trained Brain, independent OOS evaluation, or a live trading endpoint.
export function assertP4ClosedArchiveTimes(diagnosticEvidence){
 if(!diagnosticEvidence||!Array.isArray(diagnosticEvidence.champion)||!Array.isArray(diagnosticEvidence.challenger))throw Error('P4 diagnostic evidence missing before durable artifact commit');
 const audits={champion:auditP4ClosedEvidence(diagnosticEvidence.champion),challenger:auditP4ClosedEvidence(diagnosticEvidence.challenger)};
 for(const side of ['champion','challenger']){
  const audit=audits[side];
  if(audit.closed>0&&audit.validCloseTime!==audit.closed)throw Error('P4 CLOSED causal timestamps incomplete before artifact commit: '+side);
 }
 return audits;
}
export async function runP4HistoricalResearchJob({supabaseUrl,apiKey,fetchImpl=fetch,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandlesPerWindow=10000,brain,historyAtDecision,featureAtDecision,shouldStop=()=>false,onProgress,checkpointStore,roundStore,artifactStore,leaseStore,ownerToken,leaseGuard,jobId,codeRevision,championVersion,championParameters,iterations,seed,costs,accountOptions={},otherReplayOptions={},partitionOptions,explorationMode='DIAGNOSTIC_GUIDED'}={}){
 if(partitionOptions!==undefined&&(!partitionOptions||typeof partitionOptions!=='object'||Array.isArray(partitionOptions)))throw Error('invalid P4 partition options');
 if(typeof brain!=='function'||featureAtDecision!==undefined||typeof shouldStop!=='function'||(onProgress!==undefined&&typeof onProgress!=='function'))throw Error('P4 historical job requires explicit Brain and database features');
 if(leaseStore){if(!checkpointStore||!roundStore||typeof roundStore.commitLeased!=='function'||typeof checkpointStore.saveLeased!=='function')throw Error('P4 leased job requires durable checkpoint and fenced round stores');return runP4WithLease({leaseStore,jobId,ownerToken,run:async ({ensureLease,isLeaseLost})=>runP4HistoricalResearchJob({supabaseUrl,apiKey,fetchImpl,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandlesPerWindow,brain,historyAtDecision,featureAtDecision,shouldStop:()=>isLeaseLost()||shouldStop(),onProgress,checkpointStore,roundStore,artifactStore,ownerToken,jobId,codeRevision,championVersion,championParameters,iterations,seed,costs,accountOptions,otherReplayOptions,partitionOptions,explorationMode,leaseGuard:ensureLease})});}
 if(roundStore&&(!checkpointStore||typeof roundStore.load!=='function'||typeof roundStore.commit!=='function'))throw Error('P4 round persistence requires checkpoint and round stores');
 if((checkpointStore&&!jobId)||(!checkpointStore&&jobId)||checkpointStore&&(typeof checkpointStore.save!=='function'||typeof checkpointStore.load!=='function'))throw Error('P4 checkpoint requires store and jobId');
 const specFingerprint=checkpointStore?fingerprintP4JobSpec({symbol,timeframe,fromOpenTime,toOpenTime,maxCandlesPerWindow,codeRevision,championVersion,championParameters,iterations,seed,accountOptions,otherReplayOptions,partitionOptions:partitionOptions??null,explorationMode,...(asOfMs===undefined?{}:{asOfMs}),...(costs===undefined?{}:{costs})}):undefined;
 let resumeRounds=[];
 if(checkpointStore){const previous=await checkpointStore.load(jobId);if(previous){assertP4CheckpointCompatible(previous,{jobId,specFingerprint});if(!roundStore||previous.phase==='COMPLETED')throw Error('P4 job already exists; cannot safely resume');const persistedRounds=await roundStore.load(jobId,specFingerprint);resumeRounds=reconcileP4ResearchProgress({checkpoint:previous,rounds:persistedRounds}).resumeRounds;}else if(roundStore){const orphanRounds=await roundStore.load(jobId,specFingerprint);if(orphanRounds.length)throw Error('P4 orphaned research rounds without checkpoint');}}
 const saveProgress=async ({phase,completedWindows=0,loadedCandles=0,completedIterations=0,oosReport})=>{if(checkpointStore){const checkpoint=createP4Checkpoint({jobId,phase,completedWindows,loadedCandles,completedIterations,updatedAtMs:Date.now(),specFingerprint,oosReport});if(leaseGuard)await checkpointStore.saveLeased(checkpoint,ownerToken);else await checkpointStore.save(checkpoint);}};
 if(leaseGuard)await leaseGuard();
 if(!resumeRounds.length)await saveProgress({phase:'LOADING'});
 const loaded=await loadP4SegmentedHistoricalCandles({supabaseUrl,apiKey,fetchImpl,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,maxCandlesPerWindow,shouldStop,onProgress:async p=>{if(leaseGuard)await leaseGuard();await saveProgress({phase:'LOADING',...p,completedIterations:resumeRounds.length});await onProgress?.({phase:'LOADING',...p});}});
 if(!loaded.verified){await saveProgress({phase:'STOPPED',loadedCandles:loaded.loadedCandles,completedWindows:loaded.completedWindows,completedIterations:resumeRounds.length});return {status:'STOPPED_BEFORE_TRAINING',source:'SUPABASE_READ_ONLY',loadedCandles:loaded.loadedCandles,completedIterations:resumeRounds.length};}
 if(shouldStop()){await saveProgress({phase:'STOPPED',loadedCandles:loaded.loadedCandles,completedWindows:loaded.completedWindows,completedIterations:resumeRounds.length});return {status:'STOPPED_BEFORE_TRAINING',source:'SUPABASE_READ_ONLY',loadedCandles:loaded.loadedCandles,completedIterations:resumeRounds.length};}
 if(leaseGuard)await leaseGuard();
 await saveProgress({phase:'RESEARCH',loadedCandles:loaded.loadedCandles,completedWindows:loaded.completedWindows,completedIterations:resumeRounds.length});
 const featureReader=createSupabaseFeatureAtDecision({supabaseUrl,apiKey,fetchImpl});
 if(loaded.candles.length>500){
  const first=loaded.candles[0],last=loaded.candles.at(-1);
  const fromCloseTime=Number(first.closeTime),toCloseTime=Number(last.closeTime);
  if(!Number.isSafeInteger(fromCloseTime)||!Number.isSafeInteger(toCloseTime))throw Error('invalid candle close times for feature prefetch');
  await featureReader.prefetch({symbol,timeframe,fromCloseTime,toCloseTime,onPage:async ({loaded,offset})=>{
   if(shouldStop())throw Error('P4 feature prefetch stopped');
   if(leaseGuard)await leaseGuard();
   await onProgress?.({phase:'FEATURE_PREFETCH',loadedFeatures:loaded,featureOffset:offset});
  }});
  await onProgress?.({phase:'FEATURE_PREFETCH_COMPLETE'});
 }
 const research=await (partitionOptions===undefined?runP4ResearchCycle:runP4PartitionedResearchCycle)({partitionOptions,championVersion,championParameters,iterations,seed,explorationMode,candles:loaded.candles,featureAtDecision:featureReader,historyAtDecision,brain,costs,accountOptions,otherReplayOptions,shouldStop,resumeRounds,onIteration:async x=>{if(leaseGuard)await leaseGuard();if(roundStore){if(artifactStore){
   if(!leaseGuard||typeof artifactStore.write!=='function'||typeof artifactStore.read!=='function')throw Error('P4 artifact archive requires fenced lease and readback');
   const runs=x.ledgerSnapshot?.runs;
   const latest=runs?.at(-1);
   const evidence=latest?.result?.comparison?.diagnosticEvidence;
   if(!evidence||!Array.isArray(evidence.champion)||!Array.isArray(evidence.challenger))throw Error('P4 diagnostic evidence missing before durable artifact commit');
   const manifest={};
   const closedEvidenceAudit=assertP4ClosedArchiveTimes(evidence);
   for(const [side,kind] of [['champion','CHAMPION_DIAGNOSTICS'],['challenger','CHALLENGER_DIAGNOSTICS']]){
    manifest[side]=await artifactStore.write({jobId,ownerToken,specFingerprint,iteration:x.iteration,kind,records:evidence[side]});
    const restored=await artifactStore.read({jobId,iteration:x.iteration,kind,manifest:manifest[side]});
    if(restored.length!==evidence[side].length||restored.some((record,i)=>!deepEqualArtifact(record,evidence[side][i])))throw Error('P4 diagnostic archive readback mismatch: '+side);
    if(!deepEqualArtifact(auditP4ClosedEvidence(restored),closedEvidenceAudit[side]))throw Error('P4 closed evidence audit readback mismatch: '+side);
   }
   // Evidence is removed from the round JSON only after all chunks have been durably acknowledged.
   // Earlier rounds retain their own manifests; full detail is in immutable artifact chunks.
   delete latest.result.comparison.diagnosticEvidence;
   latest.result.comparison.diagnosticArtifactManifest={schemaVersion:1,...manifest};
   latest.result.comparison.closedEvidenceAudit=closedEvidenceAudit;
  }
  if(leaseGuard)await roundStore.commitLeased(jobId,ownerToken,specFingerprint,x);else await roundStore.commit(jobId,specFingerprint,x);}if(leaseGuard)await leaseGuard();await saveProgress({phase:'RESEARCH',loadedCandles:loaded.loadedCandles,completedWindows:loaded.completedWindows,completedIterations:x.iteration});await onProgress?.({phase:'RESEARCH',iteration:x.iteration,totalIterations:iterations,feedback:x.feedback});}});
 const oosReport=partitionOptions===undefined?undefined:{validationStatus:research.validationStatus??'RESERVED_NOT_EVALUATED',independentValidation:research.independentValidation===true,promotionAllowed:false,selectedVersion:research.oosEvaluation?.selectedVersion??null,sufficient:research.oosEvaluation?.sufficient??false,metrics:research.oosEvaluation?.metrics??null};
 await saveProgress({phase:research.status==='RESEARCH_CYCLE_STOPPED'?'STOPPED':'COMPLETED',loadedCandles:loaded.loadedCandles,completedWindows:loaded.completedWindows,completedIterations:research.completedIterations??0,oosReport});
 return {...research,source:'SUPABASE_READ_ONLY',dataVerified:true,loadedCandles:loaded.loadedCandles,windowCount:loaded.plan.windowCount};
}
