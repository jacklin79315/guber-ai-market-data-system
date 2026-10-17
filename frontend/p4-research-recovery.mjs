// Reconstruct P4 research parent from committed rounds only.
// This is a recovery primitive, not proof of durable/atomic persistence.
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
export function restoreP4ResearchRounds({championVersion,championParameters,iterations,rounds}={}){
 if(typeof championVersion!=='string'||!championVersion||!Number.isSafeInteger(iterations)||iterations<1||iterations>100||!Array.isArray(rounds)||rounds.length>iterations)throw Error('invalid P4 recovery configuration');
 let parentVersion=championVersion,parentParameters=validateTrainingParameters(championParameters);
 const restored=[];
 for(let i=0;i<rounds.length;i++){
  const r=rounds[i],version=championVersion+'-research-'+(i+1);
  if(!r||r.iteration!==i+1||r.runId!=='research-round-'+(i+1)||r.challengerVersion!==version||!r.feedback||!r.candidate)throw Error('P4 recovery round sequence mismatch');
  if(r.feedback.proposedNextResearchParent===version){
   parentVersion=version;parentParameters=validateTrainingParameters(r.candidate.parameters);
  }else if(r.feedback.proposedNextResearchParent!==parentVersion)throw Error('P4 recovery invalid research parent');
  restored.push(structuredClone(r));
 }
 return {completed:restored,parentVersion,parentParameters,nextIteration:restored.length};
}
