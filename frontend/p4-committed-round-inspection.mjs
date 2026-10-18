// Bridge actual persisted P4 round envelopes to integrity-checked diagnostic research.
// Read-only: never changes a round, a model, or a trading account.
import {inspectPersistedP4ResearchRound} from './p4-autonomous-diagnostic-research.mjs';
export async function inspectP4CommittedRound({store,jobId,round,minEvents=30,calibrationContract}={}){
 if(!round||!Number.isSafeInteger(round.iteration)||round.iteration<1||round.runId!=='research-round-'+round.iteration)throw Error('invalid committed P4 round');
 const runs=round.ledgerSnapshot?.runs;
 const comparison=Array.isArray(runs)?runs.at(-1)?.result?.comparison:null;
 if(!comparison?.diagnosticArtifactManifest||comparison.diagnosticEvidence!==undefined)throw Error('committed P4 diagnostic manifest missing or unarchived');
 const manifests=comparison.diagnosticArtifactManifest;
 if(manifests.schemaVersion!==1||!manifests.champion||!manifests.challenger)throw Error('invalid committed P4 artifact manifest');
 const inspection=await inspectPersistedP4ResearchRound({store,jobId,iteration:round.iteration,manifests,minEvents,calibrationContract});
 return {...inspection,source:'IMMUTABLE_P4_ROUND',closedEvidenceAudit:comparison.closedEvidenceAudit??null};
}
