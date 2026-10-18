// Explicit research-only backend runner with immutable summary persistence and recovery.
import {runP4DiagnosticBackendResearch} from './p4-diagnostic-backend-research.mjs';
import {createP4DiagnosticSummaryStore} from './p4-supabase-diagnostic-summaries.mjs';
export async function runP4PersistedDiagnosticResearch({confirm,researchJobId,supabaseUrl,serviceRoleKey,fetchImpl=fetch,summaryStore,...options}={}){
 if(confirm!=='RESEARCH_ONLY')throw Error('diagnostic persistence requires RESEARCH_ONLY confirmation');
 if(typeof researchJobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(researchJobId)||Object.hasOwn(options,'onResearchSummary'))throw Error('invalid diagnostic persisted research options');
 const store=summaryStore??createP4DiagnosticSummaryStore({supabaseUrl,serviceRoleKey,fetchImpl});
 if(typeof store.load!=='function'||typeof store.commit!=='function')throw Error('invalid diagnostic summary store');
 const existing=await store.load(researchJobId);
 if(existing)return {status:'ALREADY_COMMITTED',summary:existing,mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 const result=await runP4DiagnosticBackendResearch({confirm,researchJobId,supabaseUrl,apiKey:serviceRoleKey,fetchImpl,...options,onResearchSummary:summary=>store.commit(summary)});
 const persisted=await store.load(researchJobId);
 if(result.status==='STOPPED_BEFORE_DIAGNOSTIC_RESEARCH')return {...result,persisted:false};
 if(!persisted)throw Error('diagnostic research completed without durable summary');
 return {status:'COMMITTED',summary:persisted,result,mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
