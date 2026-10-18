import test from 'node:test';
import assert from 'node:assert/strict';
import {decideP4DiagnosticNextAction} from './p4-diagnostic-next-action.mjs';
const base={status:'OOS_RESEARCH_EVALUATED',trainingResults:[],selectedArm:{parameter:'entryLookback',from:20,to:19},ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
test('research next action distinguishes evidence gaps and failures',()=>{
 const cases=[['INSUFFICIENT_OOS_SAMPLES','COLLECT_MORE_UNTOUCHED_OOS_EVIDENCE'],['OOS_NOT_IMPROVED','REVISE_HYPOTHESIS'],['OOS_IMPROVED_RESEARCH_ONLY','REQUEST_INDEPENDENT_VALIDATION'],['NOT_EVALUATED','INVESTIGATE_MISSING_OOS']];
 for(const [oosEvidenceStatus,action] of cases){const r=decideP4DiagnosticNextAction({...base,oosEvidenceStatus});assert.equal(r.action,action);assert.equal(r.modelUpdateAllowed,false);}
 assert.equal(decideP4DiagnosticNextAction({...base,selectedArm:null}).action,'COLLECT_MORE_TRAIN_EVIDENCE');
});
test('unsafe or unknown evidence cannot produce research action',()=>{
 assert.throws(()=>decideP4DiagnosticNextAction({...base,ordersEnabled:true}),/unsafe/);
 assert.throws(()=>decideP4DiagnosticNextAction({...base,oosEvidenceStatus:'UNKNOWN'}),/unknown/);
});
