import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
const CONTROLS=Object.freeze({Entry:['entryLookback','entryThreshold'],Reward:['rewardAtrPeriod','rewardStopAtr','rewardTakeAtr']});
const SPECS=Object.freeze({entryLookback:[5,100,1],entryThreshold:[0.0001,0.02,0.0001],rewardAtrPeriod:[5,50,1],rewardStopAtr:[0.5,5,0.1],rewardTakeAtr:[1,10,0.1]});
// Generate both directions without assuming the sign of a diagnosed fault.
// Only paired research replays can establish whether a candidate is useful.
export function planP4PatternExperiments({report,parentParameters}={}){
 const parent=validateTrainingParameters(parentParameters);
 if(report?.schemaVersion!=='P4_DIAGNOSTIC_PATTERN_REPORT_V1'||typeof report.auditFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(report.auditFingerprint)||!Array.isArray(report.patterns))throw Error('invalid P4 pattern report');
 const experiments=[],unsupported=[];
 for(const pattern of report.patterns){
  if(pattern?.schemaVersion!=='P4_DIAGNOSTIC_PATTERN_V1'||typeof pattern.evidenceId!=='string'||!pattern.evidenceId)throw Error('invalid P4 pattern');
  if(pattern.status!=='HYPOTHESIS_FOR_CAUSAL_REVIEW')continue;
  const controls=CONTROLS[pattern.actor];
  if(!controls){unsupported.push({evidenceId:pattern.evidenceId,actor:pattern.actor,reason:'NO_TRAINABLE_CONTROL_FOR_ACTOR'});continue}
  for(const parameter of controls){
   const [min,max,step]=SPECS[parameter];
   for(const direction of [-1,1]){
    const value=Number((parent[parameter]+direction*step).toFixed(8));
    if(value<min-1e-9||value>max+1e-9)continue;
    experiments.push({schemaVersion:'P4_PATTERN_EXPERIMENT_V1',evidenceId:pattern.evidenceId,auditFingerprint:report.auditFingerprint,actor:pattern.actor,parameter,direction,supportingEvents:pattern.supportingEvents,parameters:validateTrainingParameters({...parent,[parameter]:value}),status:'RESEARCH_REPLAY_REQUIRED',causalEffectVerified:false,independentValidation:false,promotionAllowed:false});
   }
  }
 }
 return {schemaVersion:'P4_PATTERN_EXPERIMENT_PLAN_V1',experiments,unsupported,appliedToModels:false,promotionAllowed:false};
}
