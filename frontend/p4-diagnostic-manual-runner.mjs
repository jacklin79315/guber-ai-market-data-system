// Manually invoked diagnostic research. No automatic launch and no live orders.
import {runP4PersistedDiagnosticResearch} from './p4-diagnostic-persisted-run.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
import {researchRuleBrain} from './p3-research-rule-brain.mjs';
export function parseP4DiagnosticManualOptions(env=process.env){
 if(env.P4_RESEARCH_CONFIRM!=='RESEARCH_ONLY')throw Error('P4 diagnostic runner requires RESEARCH_ONLY');
 const researchJobId=env.P4_DIAGNOSTIC_JOB_ID;
 if(typeof researchJobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(researchJobId))throw Error('invalid diagnostic job id');
 const fromOpenTime=Number(env.P4_FROM_MS),toOpenTime=Number(env.P4_TO_MS),asOfMs=Number(env.P4_AS_OF_MS);
 const step=3600000;
 if(![fromOpenTime,toOpenTime,asOfMs].every(Number.isSafeInteger)||fromOpenTime<0||fromOpenTime%step||toOpenTime%step||toOpenTime<fromOpenTime+step*129||asOfMs<=toOpenTime+step-1)throw Error('invalid diagnostic historical window');
 const expectedCandles=(toOpenTime-fromOpenTime)/step+1;
 if(expectedCandles>2000)throw Error('diagnostic manual research limited to 2000 BTC 1h candles');
 const actor=env.P4_DIAGNOSTIC_ACTOR||'Entry';
 if(!['Entry','Reward'].includes(actor))throw Error('unsupported diagnostic actor');
 const maxArms=Number(env.P4_DIAGNOSTIC_MAX_ARMS||2);
 if(!Number.isSafeInteger(maxArms)||maxArms<1||maxArms>6)throw Error('invalid diagnostic max arms');
 const validationFraction=env.P4_DIAGNOSTIC_VALIDATION_FRACTION===undefined?0.2:Number(env.P4_DIAGNOSTIC_VALIDATION_FRACTION);
 if(!Number.isFinite(validationFraction)||validationFraction<0.2||validationFraction>0.45)throw Error('diagnostic validation fraction must be between 0.20 and 0.45');
 return {researchJobId,fromOpenTime,toOpenTime,asOfMs,expectedCandles,actor,maxArms,validationFraction};
}
export async function runP4DiagnosticManual({env=process.env,fetchImpl=fetch,onProgress}={}){
 const config=parseP4DiagnosticManualOptions(env);
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('missing server Supabase credentials');
 return runP4PersistedDiagnosticResearch({confirm:'RESEARCH_ONLY',researchJobId:config.researchJobId,supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl,symbol:'BTCUSDT',timeframe:'1h',fromOpenTime:config.fromOpenTime,toOpenTime:config.toOpenTime,asOfMs:config.asOfMs,task:{id:'COLLECT_'+config.actor.toUpperCase()+'_CAUSAL_EVIDENCE',actor:config.actor,priority:'MEDIUM',sampleCount:30},parentParameters:DEFAULT_TRAINING_PARAMETERS,brain:researchRuleBrain,costs:{feeRate:0.001,slippageRate:0},maxArms:config.maxArms,validationFraction:config.validationFraction,onProgress});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 runP4DiagnosticManual({onProgress:p=>process.stdout.write(JSON.stringify({phase:p.phase??'LOADING',loadedCandles:p.loadedCandles??null})+'\n')}).then(r=>process.stdout.write(JSON.stringify({status:r.status,jobId:r.summary?.jobId??null,completedArms:r.summary?.completedArms??null,ordersEnabled:false})+'\n')).catch(e=>{process.stderr.write('P4 diagnostic research failed: '+e.message+'\n');process.exitCode=1});
}
