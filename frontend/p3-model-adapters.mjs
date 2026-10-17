import {EXPERT_ORDER,EXPERT_FIELDS} from './p3-contract.mjs';
// Model transport adapter: accepts an injected inference function, never creates fake signals.
export function createExpertModelAdapters({infer,modelVersions}={}){
 if(typeof infer!=='function'||!modelVersions||typeof modelVersions!=='object')throw Error('invalid expert model adapter settings');
 return Object.fromEntries(EXPERT_ORDER.map(expert=>[expert,async proposal=>{
  const version=modelVersions[expert];if(typeof version!=='string'||!version.trim())throw Error('expert model not configured: '+expert);
  const request={expert,modelVersion:version,proposal:structuredClone(proposal),allowedOutputFields:[...EXPERT_FIELDS[expert]]};
  const response=await infer(request);
  if(!response||response.action!=='CONTINUE'||!response.patch||typeof response.patch!=='object'||Array.isArray(response.patch))throw Error('invalid expert inference response: '+expert);
  return {action:'CONTINUE',patch:response.patch};
 }]));
}
export function createBrainModelAdapter({infer,modelVersion}={}){
 if(typeof infer!=='function'||typeof modelVersion!=='string'||!modelVersion.trim())throw Error('Brain model not configured');
 return async proposal=>{
  const response=await infer({expert:'brain',modelVersion,proposal:structuredClone(proposal),allowedActions:['APPROVE','RETURN','REJECT','WAIT']});
  if(!response||typeof response!=='object'||!['APPROVE','RETURN','REJECT','WAIT'].includes(response.action)||typeof response.reason!=='string'||!response.reason.trim())throw Error('invalid Brain inference response');
  return response;
 };
}
