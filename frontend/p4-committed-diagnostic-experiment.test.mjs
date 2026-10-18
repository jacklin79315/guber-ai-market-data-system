import test from 'node:test';
import assert from 'node:assert/strict';
import {auditP4ClosedEvidence} from './p4-closed-evidence-audit.mjs';
import {researchP4CommittedDiagnosticRound} from './p4-committed-diagnostic-experiment.mjs';
const round={iteration:1,runId:'research-round-1',ledgerSnapshot:{runs:[{result:{comparison:{diagnosticArtifactManifest:{schemaVersion:1,champion:{chunkCount:1},challenger:{chunkCount:1}},closedEvidenceAudit:{champion:auditP4ClosedEvidence([]),challenger:auditP4ClosedEvidence([])}}}}]}};
test('committed round with no causal expert tasks does not execute OOS replay',async()=>{
 const seen=[];
 const result=await researchP4CommittedDiagnosticRound({store:{read:async({kind})=>{seen.push(kind);return [];}},jobId:'job',round});
 assert.deepEqual(seen,['CHAMPION_DIAGNOSTICS','CHALLENGER_DIAGNOSTICS']);
 assert.equal(result.status,'NO_ELIGIBLE_DIAGNOSTIC_TASK');
 assert.equal(result.ordersEnabled,false);
 assert.equal(result.modelUpdateApplied,false);
});
test('committed experiment rejects unsafe override before evidence reads',async()=>{
 await assert.rejects(()=>researchP4CommittedDiagnosticRound({store:{read:async()=>{throw Error('should not read');}},jobId:'job',round,candles:[1]}),/override forbidden/);
});
