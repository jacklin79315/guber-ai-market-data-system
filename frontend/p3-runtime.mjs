import {createInferenceTransport} from './p3-inference-transport.mjs';
import {createExpertModelAdapters,createBrainModelAdapter} from './p3-model-adapters.mjs';
import {runExpertPipeline} from './p3-pipeline.mjs';
// P3 research runtime. Explicit configuration required; never falls back to synthetic AI.
export function createP3Runtime({endpoint,token,expertVersions,brainVersion,fetchImpl,timeoutMs}={}){
 if(!expertVersions||typeof expertVersions!=='object'||typeof brainVersion!=='string'||!brainVersion.trim())throw Error('P3 models not configured');
 const infer=createInferenceTransport({endpoint,token,fetchImpl,timeoutMs});
 const experts=createExpertModelAdapters({infer,modelVersions:expertVersions});
 const brain=createBrainModelAdapter({infer,modelVersion:brainVersion});
 return async ({context,maxReturns}={})=>{
  try{return await runExpertPipeline({context,experts,brain,maxReturns})}
  catch(error){return {action:'WAIT',reason:'P3 inference unavailable or invalid',errorCode:'MODEL_EXECUTION_FAILED',proposal:null,history:[]}}
 };
}
