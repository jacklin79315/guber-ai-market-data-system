// P4 immutable in-memory research ledger; persistence is a separate integration step.
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const clone=x=>structuredClone(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const safe=x=>Number.isSafeInteger(x)&&x>=0;
export function createTrainingLedger({championVersion}={}){
 if(!nonempty(championVersion))throw Error('champion version required');
 return {championVersion,runs:[],versions:[{version:championVersion,parentVersion:null,createdByRun:null,status:'CHAMPION'}]};
}
export function registerTrainingRun(ledger,{runId,parentVersion,challengerVersion,dataStartMs,dataEndMs,parameters,seed}={}){
 if(!ledger||!Array.isArray(ledger.runs)||!Array.isArray(ledger.versions)||!nonempty(runId)||!nonempty(parentVersion)||!nonempty(challengerVersion)||parentVersion===challengerVersion||!safe(dataStartMs)||!safe(dataEndMs)||dataEndMs<=dataStartMs||!plain(parameters)||!safe(seed))throw Error('invalid training run');
 if(ledger.runs.some(r=>r.runId===runId)||ledger.versions.some(v=>v.version===challengerVersion))throw Error('duplicate training identity');
 if(!ledger.versions.some(v=>v.version===parentVersion))throw Error('unknown parent model version');
 const run={runId,parentVersion,challengerVersion,dataStartMs,dataEndMs,parameters:clone(parameters),seed,status:'REGISTERED',result:null};
 ledger.runs.push(run);ledger.versions.push({version:challengerVersion,parentVersion,createdByRun:runId,status:'CANDIDATE'});
 return clone(run);
}
export function completeTrainingRun(ledger,{runId,status,result}={}){
 if(!ledger||!Array.isArray(ledger.runs)||!['SUCCEEDED','FAILED'].includes(status)||!plain(result)||!nonempty(runId))throw Error('invalid training completion');
 const run=ledger.runs.find(r=>r.runId===runId);
 if(!run||run.status!=='REGISTERED')throw Error('training run missing or already completed');
 if(status==='SUCCEEDED'&&(!safe(result.processedCandles)||!safe(result.closedTrades)||!nonempty(result.evaluationVersion)))throw Error('missing evaluation evidence');
 if(status==='FAILED'&&!nonempty(result.reason))throw Error('missing failure reason');
 run.status=status;run.result=clone(result);
 const version=ledger.versions.find(v=>v.version===run.challengerVersion);
 version.status=status==='SUCCEEDED'?'AWAITING_INDEPENDENT_VALIDATION':'FAILED';
 return clone(run);
}
export function trainingLedgerSnapshot(ledger){
 if(!ledger||!Array.isArray(ledger.runs)||!Array.isArray(ledger.versions))throw Error('invalid training ledger');
 return clone(ledger);
}
