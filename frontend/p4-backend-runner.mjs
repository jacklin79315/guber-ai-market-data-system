// Explicitly invoked P4 backend research runner. Never starts on deployment.
import {randomBytes} from 'node:crypto';
import {runP4HistoricalResearchJob} from './p4-historical-research-job.mjs';
import {createP4SupabaseCheckpointStore} from './p4-supabase-checkpoints.mjs';
import {createP4SupabaseRoundStore} from './p4-supabase-rounds.mjs';
import {createP4ArtifactChunkStore} from './p4-supabase-artifact-chunks.mjs';
import {createP4SupabaseLeaseStore} from './p4-supabase-leases.mjs';
import {DEFAULT_TRAINING_PARAMETERS} from './p4-challenger-parameters.mjs';
import {researchRuleBrain,RESEARCH_BRAIN_VERSION} from './p3-research-rule-brain.mjs';
const requireEnv=k=>{const v=process.env[k];if(!v)throw Error('missing '+k);return v};
export function parseP4RunnerOptions(env=process.env){
 if(env.P4_RESEARCH_CONFIRM!=='RESEARCH_ONLY')throw Error('P4 runner disabled; explicitly set P4_RESEARCH_CONFIRM=RESEARCH_ONLY');
 const jobId=env.P4_JOB_ID;
 if(typeof jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(jobId))throw Error('invalid P4_JOB_ID');
 const symbol=env.P4_SYMBOL||'BTCUSDT',timeframe=env.P4_TIMEFRAME||'1h';
 if(!/^[A-Z0-9]{3,30}$/.test(symbol)||!['15m','1h','4h','1d'].includes(timeframe))throw Error('invalid P4 symbol/timeframe');
 const fromOpenTime=Number(env.P4_FROM_MS),toOpenTime=Number(env.P4_TO_MS),asOfMs=Number(env.P4_AS_OF_MS);
 const iterations=Number(env.P4_ITERATIONS||1),seed=Number(env.P4_SEED||7);
 const step={'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000}[timeframe];
 if(![fromOpenTime,toOpenTime,asOfMs].every(Number.isSafeInteger)||fromOpenTime<0||toOpenTime<fromOpenTime+step*24||asOfMs<=toOpenTime+step-1||fromOpenTime%step||toOpenTime%step||!Number.isSafeInteger(iterations)||iterations<1||iterations>3||!Number.isSafeInteger(seed)||seed<0)throw Error('invalid P4 bounded research window');
 const explorationMode=env.P4_EXPLORATION_MODE||'DIAGNOSTIC_GUIDED';
 if(!['DIAGNOSTIC_GUIDED','UNGUIDED'].includes(explorationMode))throw Error('invalid P4_EXPLORATION_MODE');
 const partitioned=env.P4_PARTITIONED==='TRUE';
 if(env.P4_PARTITIONED!==undefined&&!['TRUE','FALSE'].includes(env.P4_PARTITIONED))throw Error('invalid P4_PARTITIONED');
 const expectedCandles=(toOpenTime-fromOpenTime)/step+1;
 const scope=env.P4_RESEARCH_SCOPE||'SMOKE';
 if(!['SMOKE','HISTORICAL_24M'].includes(scope))throw Error('invalid P4_RESEARCH_SCOPE');
 if(scope==='SMOKE'&&expectedCandles>500)throw Error('P4 initial runner limited to 500 candles');
 if(scope==='HISTORICAL_24M'){
  if(env.P4_RESEARCH_CONFIRM!=='RESEARCH_ONLY'||timeframe!=='1h'||symbol!=='BTCUSDT'||iterations>3||expectedCandles<17000||expectedCandles>18000)throw Error('P4 24-month research requires BTCUSDT 1h, 17000-18000 candles and at most 3 iterations');
  if(!partitioned)throw Error('P4 24-month research requires chronological partitioned validation');
 }
 return {jobId,symbol,timeframe,fromOpenTime,toOpenTime,asOfMs,iterations,seed,expectedCandles,partitioned,scope,explorationMode};
}
export async function runP4BackendResearch({env=process.env,fetchImpl=fetch,onProgress}={}){
 const config=parseP4RunnerOptions(env);
 const supabaseUrl=env.SUPABASE_URL,serviceRoleKey=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!supabaseUrl||!serviceRoleKey)throw Error('missing server Supabase credentials');
 const storeConfig={supabaseUrl,serviceRoleKey,fetchImpl};
 return runP4HistoricalResearchJob({...config,supabaseUrl,apiKey:serviceRoleKey,fetchImpl,brain:researchRuleBrain,championVersion:RESEARCH_BRAIN_VERSION,championParameters:DEFAULT_TRAINING_PARAMETERS,codeRevision:'P4_BOUNDED_RUNNER_V3_24M_OPT_IN',...(config.partitioned?{partitionOptions:{validationFraction:0.2,minResearch:100,minValidation:30}}:{}),costs:{feeRate:0.001,slippageRate:0},checkpointStore:createP4SupabaseCheckpointStore(storeConfig),roundStore:createP4SupabaseRoundStore(storeConfig),artifactStore:createP4ArtifactChunkStore(storeConfig),leaseStore:createP4SupabaseLeaseStore(storeConfig),ownerToken:randomBytes(24).toString('hex'),onProgress});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 runP4BackendResearch({onProgress:p=>process.stdout.write(JSON.stringify({phase:p.phase,iteration:p.iteration,completedWindows:p.completedWindows})+'\n')}).then(result=>{process.stdout.write(JSON.stringify({status:result.status,completedIterations:result.completedIterations,loadedCandles:result.loadedCandles,explorationMode:result.explorationMode,validationStatus:result.validationStatus??'NOT_EVALUATED',independentValidation:result.independentValidation===true,promotionAllowed:false,liveTrading:false})+'\n')}).catch(e=>{process.stderr.write('P4 research failed: '+e.message+'\n');process.exitCode=1});
}
