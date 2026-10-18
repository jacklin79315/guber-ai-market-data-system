// Convert a verified diagnostic research task into bounded, reversible experiment arms.
// A task is a hypothesis, never evidence that either mutation direction is correct.
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
const SPECS=Object.freeze({entryLookback:[5,100,1],entryThreshold:[0.0001,0.02,0.0001],rewardAtrPeriod:[5,50,1],rewardStopAtr:[0.5,5,0.1],rewardTakeAtr:[1,10,0.1]});
const OWNERS=Object.freeze({Entry:['entryLookback','entryThreshold'],Reward:['rewardAtrPeriod','rewardStopAtr','rewardTakeAtr']});
export function proposeP4DiagnosticExperimentArms({task,parentParameters,maxArms=6,explorationSteps=[1],excludedDirections=[]}={}){
 const parent=validateTrainingParameters(parentParameters);
 if(!task||typeof task.id!=='string'||!Number.isSafeInteger(task.sampleCount)||task.sampleCount<0||!Number.isSafeInteger(maxArms)||maxArms<1||maxArms>10)throw Error('invalid diagnostic experiment task');
 const actor=task.id==='COLLECT_'+String(task.actor).toUpperCase()+'_CAUSAL_EVIDENCE'&&task.priority==='MEDIUM'?task.actor:null;
 const keys=OWNERS[actor]??[];
 const avoid=task.avoidPriorFailedDirection;
 if(avoid&&(!keys.includes(avoid.parameter)||![-1,1].includes(avoid.avoidDirection)||avoid.evidence!=='PRIOR_OOS_NOT_IMPROVED'))throw Error('invalid prior failed experiment');
 if(!Array.isArray(explorationSteps)||explorationSteps.length<1||explorationSteps.length>3||new Set(explorationSteps).size!==explorationSteps.length||explorationSteps.some(n=>!Number.isSafeInteger(n)||n<1||n>5))throw Error('invalid exploration steps');
 if(!Array.isArray(excludedDirections)||excludedDirections.some(x=>!x||!keys.includes(x.parameter)||![-1,1].includes(x.direction)))throw Error('invalid prior diagnostic evidence exclusions');
 const exclusions=new Set(excludedDirections.map(x=>x.parameter+':'+x.direction));
 const arms=[];
 for(const key of keys){
  const [min,max,step]=SPECS[key];
  for(const direction of [-1,1])for(const multiplier of explorationSteps){
   if(exclusions.has(key+':'+direction))continue;
   if(avoid?.parameter===key&&avoid.avoidDirection===direction&&Math.abs(parent[key]-avoid.failedFrom)<1e-9)continue;
   const to=Number((parent[key]+direction*step*multiplier).toFixed(8));
   if(to<min-1e-9||to>max+1e-9)continue;
   arms.push({parameter:key,direction,stepMultiplier:multiplier,from:parent[key],to,parameters:validateTrainingParameters({...parent,[key]:to})});
  }
 }
 return {schemaVersion:'P4_DIAGNOSTIC_EXPERIMENT_ARMS_V1',status:arms.length?'EXPLORATORY_ARMS_REQUIRE_CAUSAL_REPLAY':'NO_PARAMETER_EXPERIMENT_FOR_TASK',taskId:task.id,actor,arms:arms.slice(0,maxArms),mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,causalEffectProven:false};
}
