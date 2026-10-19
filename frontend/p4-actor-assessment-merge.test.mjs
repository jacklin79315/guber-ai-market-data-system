import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeP4ActorAssessments,assessP4ProposalInvariants} from './p4-rule-diagnostician.mjs';
import {diagnoseP4Decision} from './p4-independent-diagnosis.mjs';

test('P4 merges same-actor faults without violating unique actor diagnosis',()=>{
 const evidence={action:'APPROVE',proposalAtDecision:{winProbability:0.6,expectedGain:3,expectedLoss:1,expectedValue:-1}};
 const checks=assessP4ProposalInvariants({evidence});
 assert.equal(checks.filter(x=>x.actor==='Win'&&x.quality==='FAULT').length,2);
 const merged=mergeP4ActorAssessments(checks);
 assert.equal(merged.filter(x=>x.actor==='Win').length,1);
 assert.equal(merged.find(x=>x.actor==='Win').quality,'FAULT');
 assert.doesNotThrow(()=>diagnoseP4Decision({decisionId:'p4-test',outcome:'WAIT',evidence,assessments:merged}));
});
test('P4 preserves FAULT when a narrower SOUND arrives first or last',()=>{
 const sound={actor:'Risk',quality:'SOUND',responsibility:'NONE',reason:'Cap respected',evidenceKeys:['accountAtDecision']};
 const fault={actor:'Risk',quality:'FAULT',responsibility:'PRIMARY',reason:'Contradictory recorded decision',evidenceKeys:['expertHistory']};
 for(const items of [[sound,fault],[fault,sound]]){
  const [merged]=mergeP4ActorAssessments(items);
  assert.equal(merged.quality,'FAULT');
  assert.equal(merged.responsibility,'PRIMARY');
  assert.deepEqual(new Set(merged.evidenceKeys),new Set(['accountAtDecision','expertHistory']));
  assert.match(merged.reason,/Cap respected/);
  assert.match(merged.reason,/Contradictory recorded decision/);
 }
});

test('P4 persisted reassessment retains a newly evidenced fault over prior narrow SOUND',async()=>{
 const {reassessP4PersistedDiagnostics}=await import('./p4-persisted-diagnostic-reassessment.mjs');
 const evidence={action:'APPROVE',accountAtDecision:{equity:100,committedCapital:79},allocation:2,proposalAtDecision:{},expertHistory:[]};
 const prior={actor:'Risk',quality:'SOUND',responsibility:'NONE',reason:'Previously checked allocation alone',evidenceKeys:['allocation']};
 const records=[{diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',decisionId:'overcap-1',outcome:'CLOSED',requiresReview:true,attribution:[prior]},evidence}];
 const output=reassessP4PersistedDiagnostics({records});
 assert.equal(output.attributionAfter.Risk.fault,1);
 assert.equal(output.attributionAfter.Risk.sound,0);
 assert.equal(output.addedByActor.Risk,0);
 assert.equal(output.missingAfter.Risk,0);
 assert.equal(output.after.unresolved,1);
 assert.equal(output.modelUpdateApplied,false);
 assert.equal(output.ordersEnabled,false);
 assert.equal(records[0].diagnosis.attribution[0].quality,'SOUND');
});

test('P4 maps normalized Win and Risk expert identifiers without losing contradictions',async()=>{
 const {assessP4ExpertHistory}=await import('./p4-rule-diagnostician.mjs');
 for(const expert of ['winProbability','win_probability','Win Probability']){
  const result=assessP4ExpertHistory({evidence:{action:'APPROVE',expertHistory:[{expert,action:'CONTINUE',reason:'NON_POSITIVE_EXPECTANCY'}]}});
  assert.equal(result[0]?.actor,'Win');
  assert.equal(result[0]?.quality,'FAULT');
 }
 for(const expert of ['riskPosition','risk_position','Risk Position']){
  const result=assessP4ExpertHistory({evidence:{action:'APPROVE',expertHistory:[{expert,action:'CONTINUE',reason:'NON_POSITIVE_EXPECTANCY'}]}});
  assert.equal(result[0]?.actor,'Risk');
 }
});
