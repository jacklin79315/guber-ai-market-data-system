import test from 'node:test';import assert from 'node:assert/strict';import {assessP4RiskEvidence,assessP4ExpertHistory,assessP4ProposalInvariants} from './p4-rule-diagnostician.mjs';
import {collectP4DiagnosticEvidence} from './p4-diagnostic-evidence.mjs';
test('hard cap breach assigns primary Risk responsibility regardless of profit',()=>{const a=assessP4RiskEvidence({outcome:'CLOSED',evidence:{action:'APPROVE',accountAtDecision:{equity:10000,committedCapital:7000},allocation:2000,netPnl:500}});assert.equal(a[0].quality,'FAULT');assert.equal(a[0].responsibility,'PRIMARY')});
test('bounded risk is sound even when trade loses',()=>{const a=assessP4RiskEvidence({outcome:'CLOSED',evidence:{action:'APPROVE',accountAtDecision:{equity:10000,committedCapital:1000},allocation:1000,netPnl:-100}});assert.equal(a[0].quality,'SOUND')});
test('unknown account context does not invent risk rating',()=>assert.deepEqual(assessP4RiskEvidence({outcome:'WAIT',evidence:{action:'WAIT'}}),[]));
test('replay diagnosis emits bounded positive feedback but remains pending review',()=>{const rows=collectP4DiagnosticEvidence({decisions:[{id:'a',action:'APPROVE',decisionTime:1,accountAtDecision:{equity:10000,committedCapital:0},allocation:1000}],account:{closed:[{id:'a',pnl:-50,totalFees:2}],shadowOrders:[]}});assert.equal(rows[0].feedback.feedback[0].actor,'Risk');assert.equal(rows[0].feedback.feedback[0].direction,'POSITIVE');assert.equal(rows[0].feedback.requiresReview,true);assert.equal(rows[0].feedback.appliedToModels,false)});

test('Brain safety veto is not a contradictory Brain verdict',()=>{
 const evidence={action:'WAIT',expertHistory:[{expert:'brain',action:'APPROVE',reason:'research only'},{expert:'brainSafety',action:'WAIT',issues:['MISSING_STOP']}]};
 assert.deepEqual(assessP4ExpertHistory({evidence}),[]);
});
test('Brain approval mismatch without safety veto remains attributable',()=>{
 const evidence={action:'WAIT',expertHistory:[{expert:'brain',action:'APPROVE',reason:'research only'}]};
 const assessments=assessP4ExpertHistory({evidence});
 assert.equal(assessments.length,1);
 assert.equal(assessments[0].actor,'Brain');
 assert.equal(assessments[0].quality,'FAULT');
});

test('approved out-of-range probability is a Win fault, independent of PnL',()=>{
 const findings=assessP4ProposalInvariants({evidence:{action:'APPROVE',proposalAtDecision:{winProbability:1.2},netPnl:1000}});
 assert.equal(findings.length,1);
 assert.equal(findings[0].actor,'Win');
 assert.equal(findings[0].quality,'FAULT');
});
test('unknown probability is not treated as an error',()=>{
 assert.deepEqual(assessP4ProposalInvariants({evidence:{action:'APPROVE',proposalAtDecision:{winProbability:null}}}),[]);
});
test('explicit negative expected value belongs to Win field ownership without reading outcome',()=>{
 const findings=assessP4ProposalInvariants({evidence:{action:'APPROVE',proposalAtDecision:{expectedValue:-0.1},netPnl:100}});
 assert.equal(findings.length,1);
 assert.equal(findings[0].actor,'Win');
});
test('non-approved WAIT with negative expectancy is not automatically a fault',()=>{
 assert.deepEqual(assessP4ProposalInvariants({evidence:{action:'WAIT',proposalAtDecision:{expectedValue:-0.1}}}),[]);
});

test('non-positive expected holding time is attributable without hindsight',()=>{
 const findings=assessP4ProposalInvariants({evidence:{action:'APPROVE',proposalAtDecision:{expectedHoldingMs:0}}});
 assert.equal(findings.length,1);
 assert.equal(findings[0].actor,'Time');
});
test('reversed entry range is attributable without hindsight',()=>{
 const findings=assessP4ProposalInvariants({evidence:{action:'APPROVE',proposalAtDecision:{entryRange:[120,100]}}});
 assert.equal(findings.length,1);
 assert.equal(findings[0].actor,'Entry');
});
test('valid and missing entry/time evidence do not invent expert ratings',()=>{
 assert.deepEqual(assessP4ProposalInvariants({evidence:{action:'APPROVE',proposalAtDecision:{entryRange:[100,120],expectedHoldingMs:3600000}}}),[]);
 assert.deepEqual(assessP4ProposalInvariants({evidence:{action:'WAIT',proposalAtDecision:{entryRange:[120,100],expectedHoldingMs:0}}}),[]);
});

test('shadow diagnostics preserve original decision-time account context',()=>{
 const rows=collectP4DiagnosticEvidence({decisions:[{id:'shadow-a',action:'APPROVE',decisionTime:1,allocation:2000,accountAtDecision:{equity:10000,committedCapital:7000},history:[]}],account:{closed:[],shadowOrders:[{proposal:{id:'shadow-a'},reason:'NOT_FILLED'}]}});
 assert.equal(rows[0].diagnosis.outcome,'SHADOW');
 assert.equal(rows[0].evidence.accountAtDecision.equity,10000);
 assert.equal(rows[0].diagnosis.attribution[0].actor,'Risk');
 assert.equal(rows[0].diagnosis.attribution[0].quality,'FAULT');
});
test('duplicate replay decisions cannot silently overwrite diagnostic provenance',()=>{
 assert.throws(()=>collectP4DiagnosticEvidence({decisions:[{id:'dup'},{id:'dup'}],account:{closed:[],shadowOrders:[]}}),/duplicate/);
});

test('Risk WAIT on recorded negative expectancy is sound guardrail only',()=>{
 const findings=assessP4ExpertHistory({evidence:{action:'WAIT',proposalAtDecision:{expectedValue:-0.02},expertHistory:[{expert:'riskPosition',action:'WAIT',reason:'NON_POSITIVE_EXPECTANCY'}]}});
 assert.equal(findings.length,1);assert.equal(findings[0].actor,'Risk');assert.equal(findings[0].quality,'SOUND');
});
test('Risk WAIT claiming negative expectancy despite positive EV is attributable',()=>{
 const findings=assessP4ExpertHistory({evidence:{action:'WAIT',proposalAtDecision:{expectedValue:0.02},expertHistory:[{expert:'riskPosition',action:'WAIT',reason:'NON_POSITIVE_EXPECTANCY'}]}});
 assert.equal(findings.length,1);assert.equal(findings[0].quality,'FAULT');
});
test('Risk WAIT with unknown EV cannot earn a diagnostic rating',()=>{
 assert.deepEqual(assessP4ExpertHistory({evidence:{action:'WAIT',proposalAtDecision:{expectedValue:null},expertHistory:[{expert:'riskPosition',action:'WAIT',reason:'NON_POSITIVE_EXPECTANCY'}]}}),[]);
});
