// Service-role-only immutable diagnostic research summaries. No upsert or overwrite.
import {createHash} from 'node:crypto';
export function createP4DiagnosticSummaryStore({supabaseUrl,serviceRoleKey,fetchImpl=fetch}={}){
 if(typeof supabaseUrl!=='string'||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||typeof serviceRoleKey!=='string'||!serviceRoleKey||typeof fetchImpl!=='function')throw Error('invalid P4 diagnostic summary store');
 const endpoint=new URL('/rest/v1/p4_diagnostic_research_summaries',supabaseUrl);
 const headers={apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,Accept:'application/json','Content-Type':'application/json'};
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 return {
  async load(jobId){
   if(typeof jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(jobId))throw Error('invalid diagnostic summary job ID');
   const url=new URL(endpoint);url.searchParams.set('job_id','eq.'+jobId);url.searchParams.set('select','job_id,summary,summary_sha256');url.searchParams.set('limit','2');
   const response=await fetchImpl(url,{method:'GET',headers});
   if(!response.ok)throw Error('diagnostic summary read failed: '+response.status);
   const rows=await response.json();if(!Array.isArray(rows)||rows.length>1)throw Error('invalid diagnostic summary read');
   if(!rows.length)return null;
   const row=rows[0];if(row.job_id!==jobId||digest(row.summary)!==row.summary_sha256)throw Error('diagnostic summary integrity mismatch');
   return row.summary;
  },
  async commit(summary){
   if(!summary||summary.schemaVersion!=='P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1'||typeof summary.jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(summary.jobId)||summary.ordersEnabled!==false||summary.championPromotionAllowed!==false)throw Error('invalid diagnostic summary commit');
   const prior=await this.load(summary.jobId);if(prior){if(digest(prior)!==digest(summary))throw Error('diagnostic summary immutable conflict');return {status:'ALREADY_COMMITTED'};}
   const response=await fetchImpl(endpoint,{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({job_id:summary.jobId,summary,summary_sha256:digest(summary)})});
   if(!response.ok){const existing=await this.load(summary.jobId);if(existing&&digest(existing)===digest(summary))return {status:'ALREADY_COMMITTED'};throw Error('diagnostic summary commit failed: '+response.status);}
   const readback=await this.load(summary.jobId);if(!readback||digest(readback)!==digest(summary))throw Error('diagnostic summary readback mismatch');
   return {status:'COMMITTED'};
  }
 };
}
