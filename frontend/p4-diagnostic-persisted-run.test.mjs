import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4PersistedDiagnosticResearch} from './p4-diagnostic-persisted-run.mjs';
test('resumes immutable diagnostic research summary without touching market data',async()=>{
 const summary={jobId:'research_1',status:'NO_TRAIN_SELECTED_ARM'};
 const result=await runP4PersistedDiagnosticResearch({confirm:'RESEARCH_ONLY',researchJobId:'research_1',summaryStore:{load:async()=>summary,commit:async()=>{throw Error('must not overwrite');}},fetchImpl:async()=>{throw Error('must not fetch');},symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:100,toOpenTime:200,asOfMs:300});
 assert.equal(result.status,'ALREADY_COMMITTED');
 assert.deepEqual(result.summary,summary);
 assert.equal(result.ordersEnabled,false);
});
test('requires explicit research confirmation before loading existing summaries',async()=>{
 await assert.rejects(()=>runP4PersistedDiagnosticResearch({confirm:'LIVE',researchJobId:'research_1',summaryStore:{load:async()=>{throw Error('should not read');}}}),/RESEARCH_ONLY/);
});

test('rejects missing historical window even when job ID exists',async()=>{
 await assert.rejects(()=>runP4PersistedDiagnosticResearch({confirm:'RESEARCH_ONLY',researchJobId:'research_1',summaryStore:{load:async()=>({jobId:'research_1'}),commit:async()=>{}}}),/missing immutable diagnostic research window/);
});
