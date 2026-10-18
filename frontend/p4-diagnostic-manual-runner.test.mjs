import test from 'node:test';
import assert from 'node:assert/strict';
import {parseP4DiagnosticManualOptions} from './p4-diagnostic-manual-runner.mjs';
const valid={P4_RESEARCH_CONFIRM:'RESEARCH_ONLY',P4_DIAGNOSTIC_JOB_ID:'smoke_1',P4_FROM_MS:'0',P4_TO_MS:String(139*3600000),P4_AS_OF_MS:String(141*3600000),P4_DIAGNOSTIC_ACTOR:'Entry'};
test('diagnostic manual CLI validates bounded historical smoke',()=>{
 const r=parseP4DiagnosticManualOptions(valid);
 assert.equal(r.expectedCandles,140);
 assert.equal(r.maxArms,2);
});
test('diagnostic manual CLI refuses live and oversized research',()=>{
 assert.throws(()=>parseP4DiagnosticManualOptions({...valid,P4_RESEARCH_CONFIRM:'LIVE'}),/RESEARCH_ONLY/);
 assert.throws(()=>parseP4DiagnosticManualOptions({...valid,P4_TO_MS:String(500*3600000),P4_AS_OF_MS:String(502*3600000)}),/500/);
});
