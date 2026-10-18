import test from 'node:test';import assert from 'node:assert/strict';import {assessP4RiskEvidence,assessP4ExpertHistory} from './p4-rule-diagnostician.mjs';
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
