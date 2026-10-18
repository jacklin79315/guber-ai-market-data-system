// Bridge actual persisted P4 round envelopes to integrity-checked diagnostic research.
// Read-only: never changes a round, a model, or a trading account.
import {auditP4ClosedEvidence} from './p4-closed-evidence-audit.mjs';
import {inspectPersistedP4ResearchRound} from './p4-autonomous-diagnostic-research.mjs';
export async function inspectP4CommittedRound({store,jobId,round,minEvents=30,calibrationContract}={}){
 if(!round||!Number.isSafeInteger(round.iteration)||round.iteration<1||round.runId!=='research-round-'+round.iteration)throw Error('invalid committed P4 round');
 const runs=round.ledgerSnapshot?.runs;
 const comparison=Array.isArray(runs)?runs.at(-1)?.result?.comparison:null;
 if(!comparison?.diagnosticArtifactManifest||comparison.diagnosticEvidence!==undefined)throw Error('committed P4 diagnostic manifest missing or unarchived');
 const manifests=comparison.diagnosticArtifactManifest;
 if(manifests.schemaVersion!==1||!manifests.champion||!manifests.challenger)throw Error('invalid committed P4 artifact manifest');
 const verifiedStore={read:async args=>{
  const records=await store.read(args);
  const side=args.kind==='CHAMPION_DIAGNOSTICS'?'champion':args.kind==='CHALLENGER_DIAGNOSTICS'?'challenger':null;
  if(!side)throw Error('unexpected P4 diagnostic artifact kind');
  const expected=comparison.closedEvidenceAudit?.[side];
  if(expected){
   const actual=auditP4ClosedEvidence(records);
   if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('P4 committed closed evidence audit mismatch: '+side);
  }
  return records;
 }};
 const inspection=await inspectPersistedP4ResearchRound({store:verifiedStore,jobId,iteration:round.iteration,manifests,minEvents,calibrationContract});
 const nextResearchTasks=Object.entries(inspection.results).flatMap(([side,result])=>result.researchTasks.tasks.map(task=>({...task,side}))).sort((a,b)=>({BLOCKING:0,HIGH:1,MEDIUM:2}[a.priority]??3)-({BLOCKING:0,HIGH:1,MEDIUM:2}[b.priority]??3)||a.id.localeCompare(b.id)||a.side.localeCompare(b.side));
 return {...inspection,source:'IMMUTABLE_P4_ROUND',closedEvidenceAudit:comparison.closedEvidenceAudit??null,nextResearchTasks,automaticModelUpdate:false};
}
