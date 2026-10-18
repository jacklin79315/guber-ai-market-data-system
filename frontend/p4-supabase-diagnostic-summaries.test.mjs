import test from 'node:test';
import assert from 'node:assert/strict';
import {createP4DiagnosticSummaryStore} from './p4-supabase-diagnostic-summaries.mjs';
test('immutable diagnostic summary commits once and verifies readback',async()=>{
 let row=null,posts=0;
 const fetchImpl=async(url,options)=>{
  if(options.method==='GET')return {ok:true,json:async()=>row?[row]:[]};
  posts++;row=JSON.parse(options.body);return {ok:true};
 };
 const store=createP4DiagnosticSummaryStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'server-secret',fetchImpl});
 const summary={schemaVersion:'P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1',jobId:'test_1',ordersEnabled:false,championPromotionAllowed:false,status:'NO_TRAIN_SELECTED_ARM'};
 assert.deepEqual(await store.commit(summary),{status:'COMMITTED'});
 assert.deepEqual(await store.commit(summary),{status:'ALREADY_COMMITTED'});
 assert.equal(posts,1);
 await assert.rejects(()=>store.commit({...summary,status:'changed'}),/immutable conflict/);
});

test('Supabase JSONB key reordering does not invalidate stored summary',async()=>{
 let row;
 const fetchImpl=async(_url,options)=>{
  if(options.method==='GET')return {ok:true,json:async()=>row?[row]:[]};
  const posted=JSON.parse(options.body);
  row={...posted,summary:{status:posted.summary.status,championPromotionAllowed:false,ordersEnabled:false,jobId:posted.summary.jobId,schemaVersion:posted.summary.schemaVersion}};
  return {ok:true};
 };
 const store=createP4DiagnosticSummaryStore({supabaseUrl:'https://example.supabase.co',serviceRoleKey:'secret',fetchImpl});
 const summary={schemaVersion:'P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1',jobId:'canonical_1',ordersEnabled:false,championPromotionAllowed:false,status:'COMPLETED'};
 assert.deepEqual(await store.commit(summary),{status:'COMMITTED'});
 assert.equal((await store.load('canonical_1')).status,'COMPLETED');
});
