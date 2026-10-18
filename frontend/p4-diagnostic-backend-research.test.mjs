import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4DiagnosticBackendResearch} from './p4-diagnostic-backend-research.mjs';
test('diagnostic backend requires explicit research-only confirmation before any data fetch',async()=>{
 let calls=0;
 await assert.rejects(()=>runP4DiagnosticBackendResearch({confirm:'LIVE',fetchImpl:async()=>{calls++;throw Error('unexpected network');}}),/RESEARCH_ONLY/);
 assert.equal(calls,0);
});
test('diagnostic backend rejects missing brain and invalid callbacks before data fetch',async()=>{
 await assert.rejects(()=>runP4DiagnosticBackendResearch({confirm:'RESEARCH_ONLY'}),/invalid diagnostic backend controls/);
});
