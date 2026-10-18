import test from 'node:test';
import assert from 'node:assert/strict';
import {parseP4ChainOptions,runP4DiagnosticChainFromEnv} from './p4-diagnostic-chain-runner.mjs';
const env={P4_RESEARCH_CONFIRM:'RESEARCH_ONLY',P4_ORDERS_ENABLED:'false',P4_MODEL_UPDATE_ALLOWED:'false',P4_CHAMPION_PROMOTION_ALLOWED:'false',P4_INITIAL_TASK_ID:'existing_proposal',P4_CHAIN_ID:'chain_123',P4_WINDOWS_JSON:JSON.stringify([{fromOpenTime:3600000000,toOpenTime:4316400000,asOfMs:4323600000}]),SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'};
test('manual chain config remains bounded and research-only',()=>{
 const options=parseP4ChainOptions(env,10000000000);
 assert.equal(options.grant.maxRounds,1);
 assert.equal(options.grant.ordersEnabled,false);
 assert.equal(options.windows[0].symbol,'BTCUSDT');
});
test('manual chain refuses missing explicit safety switches',()=>{
 assert.throws(()=>parseP4ChainOptions({...env,P4_ORDERS_ENABLED:'true'},10000000000),/research-only/);
});
test('manual chain passes distinct durable IDs and explicit grant to backend',async()=>{
 let args;
 await runP4DiagnosticChainFromEnv({env,now:10000000000,runner:async options=>{args=options;return {status:'STOPPED_RESEARCH_GATE'}}});
 assert.equal(args.initialTaskId,'existing_proposal');
 assert.equal(await args.createExecutionJobId({round:1}),'chain_123_job_1');
 assert.equal(args.grant.championPromotionAllowed,false);
});
