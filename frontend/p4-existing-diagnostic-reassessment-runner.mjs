import {createP4ArtifactChunkStore} from './p4-supabase-artifact-chunks.mjs';
import {inspectPersistedP4ResearchRound} from './p4-autonomous-diagnostic-research.mjs';

// Read-only retrospective assessment. Build manifests from immutable stored
// chunk hashes, then let the existing reader verify every SHA256 and fragment.
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('missing read credentials');
const jobId='p4_btc_24m_accept_20261018',iteration=1;
const kinds=['CHAMPION_DIAGNOSTICS','CHALLENGER_DIAGNOSTICS'];
const manifests={};
for(const kind of kinds){
 const rows=[];
 const pageSize=100;
 for(let offset=0;;offset+=pageSize){
  const endpoint=new URL('/rest/v1/p4_research_artifact_chunks',url);
  for(const [k,v] of Object.entries({job_id:'eq.'+jobId,iteration:'eq.1',artifact_kind:'eq.'+kind,select:'chunk_index,payload_sha256',order:'chunk_index.asc',limit:String(pageSize),offset:String(offset)}))endpoint.searchParams.set(k,v);
  let response;
  for(let attempt=0;attempt<4;attempt++){
   try{response=await fetch(endpoint,{headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(60000)});}
   catch(error){if(attempt===3)throw error;continue;}
   if(response.ok)break;
   if(attempt===3||![429,500,502,503,504].includes(response.status))throw Error('manifest read failed '+response.status+' kind='+kind+' offset='+offset+' requestId='+(response.headers.get('x-request-id')??'unknown')+' retryAfter='+(response.headers.get('retry-after')??'none'));
  }
  let page;
  try{page=await response.json();}catch{throw Error('manifest JSON decode failed kind='+kind+' offset='+offset);}
  if(!Array.isArray(page))throw Error('invalid manifest page kind='+kind+' offset='+offset);
  if(page.length>pageSize)throw Error('manifest page exceeds limit: '+kind+' offset='+offset);
  rows.push(...page);if(page.length<pageSize)break;
 }
 if(!rows.length)throw Error('missing existing diagnostic chunks: '+kind);
 for(let i=0;i<rows.length;i++)if(rows[i].chunk_index!==i||!/^[a-f0-9]{64}$/.test(rows[i].payload_sha256))throw Error('invalid stored chunk index/hash');
 // The immutable acceptance round has 1,246 decisions per side. The reader
 // verifies all payload hashes and reconstructs fragments before acceptance.
 const manifest={chunkCount:rows.length,recordCount:1246,fragmented:true,chunkHashes:rows.map(r=>r.payload_sha256)};
 manifests[kind==='CHAMPION_DIAGNOSTICS'?'champion':'challenger']=manifest;
}
const store=createP4ArtifactChunkStore({supabaseUrl:url,serviceRoleKey:key});
const result=await inspectPersistedP4ResearchRound({store,jobId,iteration,manifests});
const summary=Object.fromEntries(['champion','challenger'].map(label=>[label,result.results[label].reassessment]));
const decisionInputCoverage=Object.fromEntries(['champion','challenger'].map(label=>[label,result.results[label].decisionInputs]));
const calibrationEligibility=Object.fromEntries(['champion','challenger'].map(label=>[label,result.results[label].calibrationEligibility]));
// Fail closed if an incomplete or mismatched historical round is supplied.
// This acceptance round has 1,246 immutable decisions per side, including fragments.
for(const side of ['champion','challenger']){
 const manifest=manifests[side],report=summary[side];
 if(manifest.recordCount!==1246||report?.sourceRecords!==manifest.recordCount)throw Error('incomplete 24-month historical reassessment: '+side);
 if(manifest.chunkCount!==(side==='champion'?254:201)||manifest.fragmented!==true)throw Error('unexpected immutable artifact manifest: '+side);
 if(report.before.reviewed+report.before.unresolved!==report.sourceRecords||report.after.reviewed+report.after.unresolved!==report.sourceRecords)throw Error('invalid reassessment coverage totals: '+side);
 if(report.modelUpdateApplied!==false)throw Error('unsafe model update flag: '+side);
 const inputs=decisionInputCoverage[side];
 if(!inputs||inputs.totalEvents!==report.sourceRecords||inputs.ordersEnabled!==false||inputs.modelUpdateApplied!==false)throw Error('invalid input coverage contract: '+side);
 if(Object.values(inputs.byOutcome??{}).reduce((n,row)=>n+row.records,0)!==report.sourceRecords)throw Error('invalid input coverage totals: '+side);
 for(const outcome of ['CLOSED','SHADOW','WAIT','RETURN']){
  const slot=inputs.byOutcome[outcome];
  if(!slot||slot.records!==report.outcomes[outcome]||slot.approved>slot.records||slot.proposalPresent>slot.records||slot.expertHistoryPresent>slot.records)throw Error('invalid input outcome: '+side+'/'+outcome);
  for(const fields of Object.values(slot.fieldCounts??{}))for(const count of Object.values(fields))if(!Number.isInteger(count)||count<0||count>slot.proposalPresent)throw Error('invalid causal field count: '+side+'/'+outcome);
  const expectedFields={Entry:['entryRange'],Reward:['expectedGain','expectedLoss','riskReward'],Win:['winProbability','expectedValue'],Time:['expectedHoldingMs']};
  for(const [actor,keys] of Object.entries(expectedFields)){
   if(!slot.fieldCounts||!Object.hasOwn(slot.fieldCounts,actor))throw Error('missing causal actor: '+side+'/'+outcome+'/'+actor);
   for(const key of keys)if(!Number.isInteger(slot.fieldCounts[actor]?.[key]))throw Error('missing causal field: '+side+'/'+outcome+'/'+actor+'/'+key);
  }

 }

 const by=report.byOutcome;
 if(!by||typeof by!=='object')throw Error('missing per-outcome diagnostic report: '+side);
 const actors=['Entry','Reward','Win','Risk','Time','Brain'];
 for(const outcome of ['CLOSED','SHADOW','WAIT','RETURN']){
  const row=by[outcome];
  if(!row||row.records!==report.outcomes[outcome]||!Number.isInteger(row.beforeReviewed)||!Number.isInteger(row.afterReviewed)||row.beforeReviewed<0||row.afterReviewed<0||row.beforeReviewed>row.records||row.afterReviewed>row.records)throw Error('invalid outcome coverage: '+side+'/'+outcome);
  for(const actor of actors){const missing=row.missingByActor?.[actor];if(!Number.isInteger(missing)||missing<0||missing>row.records)throw Error('invalid actor coverage: '+side+'/'+outcome+'/'+actor);}
 }
 if(Object.values(by).reduce((sum,row)=>sum+row.records,0)!==report.sourceRecords||Object.values(by).reduce((sum,row)=>sum+row.afterReviewed,0)!==report.after.reviewed)throw Error('per-outcome totals do not reconcile: '+side);
}
process.stdout.write(JSON.stringify({status:'PASS',jobId,iteration,decisionInputCoverage,calibrationEligibility,manifestCounts:Object.fromEntries(Object.entries(manifests).map(([k,m])=>[k,{chunks:m.chunkCount,records:m.recordCount,fragmented:m.fragmented}])),summary,modelUpdateApplied:false,ordersEnabled:false})+'\n');
