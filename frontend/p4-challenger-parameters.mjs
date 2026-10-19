// P4 deterministic bounded parameter mutation. Research candidates only; no auto-promotion.
const SPECS={entryLookback:{min:5,max:100,step:1},entryThreshold:{min:0.0001,max:0.02,step:0.0001},rewardAtrPeriod:{min:5,max:50,step:1},rewardStopAtr:{min:0.5,max:5,step:0.1},rewardTakeAtr:{min:1,max:10,step:0.1}};
const keys=Object.keys(SPECS);
const round=(n,p=8)=>Number(n.toFixed(p));
export function validateTrainingParameters(params){
 if(!params||typeof params!=='object'||Array.isArray(params)||Object.keys(params).length!==keys.length||keys.some(k=>!Object.hasOwn(params,k)))throw Error('invalid trainable parameter shape');
 for(const k of keys){const {min,max,step}=SPECS[k],v=params[k];if(!Number.isFinite(v)||v<min-1e-9||v>max+1e-9||Math.abs((v-min)/step-Math.round((v-min)/step))>1e-6)throw Error('invalid parameter '+k)}
 return structuredClone(params);
}
export function generateChallengerParameters({parent,seed,iteration=0,preferredActor=null,directedProbe=null,visitedParameterSets=[]}={}){
 const current=validateTrainingParameters(parent);
 const visited=new Set(visitedParameterSets.map(p=>JSON.stringify(validateTrainingParameters(p))));
 const unseen=p=>!visited.has(JSON.stringify(p));
 if(!Number.isSafeInteger(seed)||seed<0||!Number.isSafeInteger(iteration)||iteration<0)throw Error('invalid mutation seed');
 // Integer-only deterministic mixing, independent of Math.random and process state.
 let x=(seed^(Math.imul(iteration+1,0x9e3779b1)))>>>0;
 const next=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0};
 if(directedProbe!==null){
  const {parameter,direction}=directedProbe;
  if(!Object.hasOwn(SPECS,parameter)||![1,-1].includes(direction))throw Error('invalid directed research probe');
  const {min,max,step}=SPECS[parameter],at=Math.round((current[parameter]-min)/step),ticks=Math.round((max-min)/step),candidate=at+direction;
  if(candidate>=0&&candidate<=ticks){const trial={...current,[parameter]:round(min+candidate*step)};if(unseen(trial))return {parameters:validateTrainingParameters(trial),mutatedParameter:parameter,from:parent[parameter],to:trial[parameter],seed,iteration,probeSource:'PRIOR_SAME_WINDOW_RESULT'};}
 }
 const preferredKeys=preferredActor==='Entry'?keys.filter(k=>k.startsWith('entry')):preferredActor==='Reward'?keys.filter(k=>k.startsWith('reward')):keys;
 const offset=next()%preferredKeys.length;
 for(let j=0;j<preferredKeys.length;j++){
  const key=preferredKeys[(offset+j)%preferredKeys.length],{min,max,step}=SPECS[key];
  const ticks=Math.round((max-min)/step),at=Math.round((current[key]-min)/step);
  const direction=(next()&1)?1:-1;
  const candidate=at+direction;
  if(candidate>=0&&candidate<=ticks){const trial={...current,[key]:round(min+candidate*step)};if(unseen(trial))return {parameters:validateTrainingParameters(trial),mutatedParameter:key,from:parent[key],to:trial[key],seed,iteration}}
 }
 // Search all one-tick neighbors before admitting exhaustion; never recycle a known candidate.
 for(const key of preferredKeys){const {min,max,step}=SPECS[key],at=Math.round((current[key]-min)/step),ticks=Math.round((max-min)/step);for(const direction of [-1,1]){const index=at+direction;if(index<0||index>ticks)continue;const trial={...current,[key]:round(min+index*step)};if(unseen(trial))return {parameters:validateTrainingParameters(trial),mutatedParameter:key,from:parent[key],to:trial[key],seed,iteration,probeSource:'UNSEEN_NEIGHBOR'};}}
 // When immediate neighbors are exhausted, expand the radius on a single parameter.
 // This escapes a local oscillation without changing multiple expert parameters at once.
 for(let radius=2;radius<=1000;radius++){
  let possible=false;
  for(const key of preferredKeys){const {min,max,step}=SPECS[key],at=Math.round((current[key]-min)/step),ticks=Math.round((max-min)/step);for(const direction of [-1,1]){const index=at+direction*radius;if(index<0||index>ticks)continue;possible=true;const trial={...current,[key]:round(min+index*step)};if(unseen(trial))return {parameters:validateTrainingParameters(trial),mutatedParameter:key,from:parent[key],to:trial[key],seed,iteration,probeSource:'UNSEEN_RADIUS_EXPANSION'};}}
  if(!possible)break;
 }
 return {parameters:current,mutatedParameter:null,from:null,to:null,seed,iteration,probeSource:'SEARCH_SPACE_EXHAUSTED'};
}
export const DEFAULT_TRAINING_PARAMETERS=Object.freeze({entryLookback:20,entryThreshold:0.001,rewardAtrPeriod:14,rewardStopAtr:1.5,rewardTakeAtr:3});
