import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPersistedP4ResearchRound} from './p4-autonomous-diagnostic-research.mjs';
import {DIAGNOSTIC_ACTORS} from './p4-independent-diagnosis.mjs';
const row=(id)=>({diagnosis:{decisionId:id,outcome:'WAIT',schemaVersion:'P4_DIAGNOSIS_V1',requiresReview:false,unassessedActors:[],attribution:DIAGNOSTIC_ACTORS.map(actor=>({actor,quality:'SOUND',responsibility:'NONE',reason:'decision-time evidence',evidenceKeys:['decisionTime']}))},feedback:{schemaVersion:'P4_FEEDBACK_V1',decisionId:id,feedback:DIAGNOSTIC_ACTORS.map(actor=>({actor,direction:'POSITIVE',weight:1})),appliedToModels:false},evidence:{decisionTime:1,proposalAtDecision:{winProbability:0.5,expectedValue:1},expertHistory:[],accountAtDecision:{},riskDiagnostics:{}}});
test('persisted artifact reader attaches six-actor reliability research without promotion',async()=>{
 const kinds=[];
 const store={read:async ({kind})=>{kinds.push(kind);return [row('decision_a'),row('decision_b')]}};
 const manifest={chunkCount:1,recordCount:2,chunkHashes:['hash']};
 const result=await inspectPersistedP4ResearchRound({store,jobId:'historical_1',iteration:1,manifests:{champion:manifest,challenger:manifest},minEvents:2});
 assert.deepEqual(kinds,['CHAMPION_DIAGNOSTICS','CHALLENGER_DIAGNOSTICS']);
 for(const label of ['champion','challenger']){
  const reassessment=result.results[label].reassessment;
  assert.equal(reassessment.sourceRecords,2);
  assert.equal(reassessment.before.reviewed,2);
  assert.equal(reassessment.after.reviewed,2);
  assert.equal(reassessment.modelUpdateApplied,false);
  const reliability=result.results[label].expertReliability;
  assert.equal(reliability.reviewedEvents,2);
  assert.equal(reliability.experts.length,6);
  assert.equal(reliability.weightChangeApplied,false);
  assert.equal(reliability.independentValidation,false);
 }
 assert.equal(result.ordersEnabled,false);
});
