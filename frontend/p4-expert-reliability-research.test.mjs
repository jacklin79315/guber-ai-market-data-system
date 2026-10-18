import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeP4ExpertReliability} from './p4-expert-reliability-research.mjs';
import {DIAGNOSTIC_ACTORS} from './p4-independent-diagnosis.mjs';
const record=(fault=false)=>({diagnosis:{schemaVersion:'P4_DIAGNOSIS_V1',requiresReview:false,unassessedActors:[],attribution:DIAGNOSTIC_ACTORS.map(actor=>({actor,quality:fault&&actor==='Brain'?'FAULT':'SOUND',responsibility:fault&&actor==='Brain'?'PRIMARY':'NONE'}))},feedback:{schemaVersion:'P4_FEEDBACK_V1'}});
test('only complete reviews generate observational reliability evidence',()=>{
 const result=summarizeP4ExpertReliability({records:[record(),record(true)],minReviewed:2});
 assert.equal(result.status,'REVIEWED_EVIDENCE_AVAILABLE');
 assert.equal(result.experts.find(x=>x.actor==='Brain').primaryFault,1);
 assert.equal(result.experts.find(x=>x.actor==='Entry').sound,2);
 assert.equal(result.weightChangeApplied,false);
 assert.equal(result.independentValidation,false);
});
test('unresolved evidence does not become a punishment or model update',()=>{
 const r=record(true);r.diagnosis.requiresReview=true;
 const result=summarizeP4ExpertReliability({records:[r],minReviewed:2});
 assert.equal(result.reviewedEvents,0);
 assert.equal(result.experts.find(x=>x.actor==='Brain').primaryFault,0);
 assert.equal(result.experts.find(x=>x.actor==='Brain').observedFaultFraction,null);
 assert.equal(result.weightChangeProposed,false);
});
test('reject fabricated complete review with missing expert',()=>{
 const r=record();r.diagnosis.attribution.pop();
 assert.throws(()=>summarizeP4ExpertReliability({records:[r]}),/incomplete diagnosis/);
});
