// Convert a verified diagnostic research task into bounded, reversible experiment arms.
// A task is a hypothesis, never evidence that either mutation direction is correct.
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
const SPECS=Object.freeze({entryLookback:[5,100,1],entryThreshold:[0.0001,0.02,0.0001],rewardAtrPeriod:[5,50,1],rewardStopAtr:[0.5,5,0.1],rewardTakeAtr:[1,10,0.1]});
const OWNERS=Object.freeze({Entry:['entryLookback','entryThreshold'],Reward:['rewardAtrPeriod','rewardStopAtr','rewardTakeAtr']});
export function proposeP4DiagnosticExperimentArms({task,parentParameters,maxArms=6}={}){
 const parent=validateTrainingParameters(parentParameters);
 if(!task||typeof task.id!=='string'||!Number.isSafeInteger(task.sampleCount)||task.sampleCount<0||!Number.isSafeInteger(maxArms)||maxArms<1||maxArms>10)throw Error('invalid diagnostic experiment task');
 const actor=task.id==='COLLECT_'+String(task.actor).toUpperCase()+'_CAUSAL_EVIDENCE'&&task.priority==='MEDIUM'?task.actor:null;
 const keys=OWNERS[actor]??[];
 const arms=[];
 for(const key of keys){
  const [min,max,step]=SPECS[key];
  for(const direction of [-1,1]){
   const to=Number((parent[key]+direction*step).toFixed(8));
   if(to<min-1e-9||to>max+1e-9)continue;
   arms.push({parameter:key,direction,from:parent[key],to,parameters:validateTrainingParameters({...parent,[key]:to})});
  }
 }
 return {schemaVersion:'P4_DIAGNOSTIC_EXPERIMENT_ARMS_V1',status:arms.length?'EXPLORATORY_ARMS_REQUIRE_CAUSAL_REPLAY':'NO_PARAMETER_EXPERIMENT_FOR_TASK',taskId:task.id,actor,arms:arms.slice(0,maxArms),mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,causalEffectProven:false};
}
