import test from 'node:test';
import assert from 'node:assert/strict';
import {auditP4ClosedEvidence} from './p4-closed-evidence-audit.mjs';
import {inspectP4CommittedRound} from './p4-committed-round-inspection.mjs';
const round={iteration:1,runId:'research-round-1',ledgerSnapshot:{runs:[{result:{comparison:{diagnosticArtifactManifest:{schemaVersion:1,champion:{chunkCount:1},challenger:{chunkCount:2}},closedEvidenceAudit:{champion:auditP4ClosedEvidence([]),challenger:auditP4ClosedEvidence([])}}}}]}};
test('committed round bridges both immutable diagnostic manifests into research-only inspection',async()=>{
 const seen=[];const store={read:async({kind,manifest})=>{seen.push([kind,manifest.chunkCount]);return []}};
 const result=await inspectP4CommittedRound({store,jobId:'round-test',round});
 assert.deepEqual(seen,[['CHAMPION_DIAGNOSTICS',1],['CHALLENGER_DIAGNOSTICS',2]]);
 assert.equal(result.source,'IMMUTABLE_P4_ROUND');
 assert.equal(result.ordersEnabled,false);
 assert.equal(result.modelUpdateApplied,false);
 assert.equal(result.championPromotionAllowed,false);
 assert.equal(result.closedEvidenceAudit.champion.closed,0);
});
test('unarchived or malformed committed rounds are rejected',async()=>{
 await assert.rejects(()=>inspectP4CommittedRound({store:{read:async()=>[]},jobId:'x',round:{...round,runId:'other'}}),/invalid committed/);
 await assert.rejects(()=>inspectP4CommittedRound({store:{read:async()=>[]},jobId:'x',round:{...round,ledgerSnapshot:{runs:[]}}}),/manifest missing/);
});

test('tampered committed evidence audit blocks diagnostic research',async()=>{
 const corrupted=structuredClone(round);
 corrupted.ledgerSnapshot.runs[0].result.comparison.closedEvidenceAudit.champion.closed=5;
 await assert.rejects(()=>inspectP4CommittedRound({store:{read:async()=>[]},jobId:'x',round:corrupted}),/audit mismatch: champion/);
});
