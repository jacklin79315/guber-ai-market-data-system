import test from 'node:test';import assert from 'node:assert/strict';
import {diagnoseP4Decision,scoreP4DiagnosticFeedback} from './p4-independent-diagnosis.mjs';
import {discoverP4DiagnosticPatterns} from './p4-diagnostic-patterns.mjs';
function row(id,outcome,quality='FAULT'){
 const diagnosis=diagnoseP4Decision({decisionId:id,outcome,evidence:{decisionTime:id},assessments:[{actor:'Entry',quality,responsibility:quality==='FAULT'?'PRIMARY':'NONE',reason:'Recorded causal invariant violation',evidenceKeys:['decisionTime']}]});
 return {diagnosis,feedback:scoreP4DiagnosticFeedback(diagnosis)};
}
test('repeated faults form traceable hypotheses, not automatic parameter changes',()=>{
 const rows=Array.from({length:30},(_,i)=>row('d'+i,i%2?'CLOSED':'WAIT'));
 const a=discoverP4DiagnosticPatterns({rows}),b=discoverP4DiagnosticPatterns({rows});
 assert.equal(a.patterns[0].supportingEvents,30);assert.equal(a.patterns[0].status,'HYPOTHESIS_FOR_CAUSAL_REVIEW');assert.equal(a.patterns[0].evidenceId,b.patterns[0].evidenceId);
 assert.equal(a.patterns[0].parameter,null);assert.equal(a.patterns[0].direction,null);assert.equal(a.autonomousLearningReady,false);
});
test('winning or losing outcome alone never creates a fault pattern',()=>{
 const a=discoverP4DiagnosticPatterns({rows:[row('a','CLOSED','SOUND'),row('b','CLOSED','SOUND')]});
 assert.equal(a.patterns.length,0);
});
test('small sample stays unconfirmed',()=>{
 const a=discoverP4DiagnosticPatterns({rows:[row('a','WAIT')]});
 assert.equal(a.patterns[0].status,'INSUFFICIENT_PATTERN_SAMPLES');
});
