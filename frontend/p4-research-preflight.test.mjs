import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightP4Research} from './p4-research-preflight.mjs';
const hour=3600000;
const env={P4_RESEARCH_CONFIRM:'RESEARCH_ONLY',P4_JOB_ID:'preflight_test',P4_FROM_MS:'0',P4_TO_MS:String(24*hour),P4_AS_OF_MS:String(26*hour),SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'};
test('P4 preflight reads required database tables without writes',async()=>{
 const calls=[];
 const result=await preflightP4Research({env,fetchImpl:async(url,options)=>{calls.push({url,method:options.method});return {ok:true,json:async()=>[]}}});
 assert.equal(result.ready,true);assert.equal(calls.length,6);assert.ok(calls.every(c=>c.method==='GET'));assert.equal(result.liveTrading,false);
});
test('P4 preflight fails closed on inaccessible research schema',async()=>{
 await assert.rejects(preflightP4Research({env,fetchImpl:async()=>({ok:false,status:403})}),/read failed: 403/);
 await assert.rejects(preflightP4Research({env:{...env,SUPABASE_SERVICE_ROLE_KEY:''}}),/credentials/);
});
