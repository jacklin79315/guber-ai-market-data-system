import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
// Diagnostic-guided proposal only. Not a model update or Champion promotion.
// A finding must name a trainable control and a causal, validated direction.
const OWNERS=Object.freeze({entryLookback:'Entry',entryThreshold:'Entry',rewardAtrPeriod:'Reward',rewardStopAtr:'Reward',rewardTakeAtr:'Reward'});
const SPECS=Object.freeze({entryLookback:[5,100,1],entryThreshold:[0.0001,0.02,0.0001],rewardAtrPeriod:[5,50,1],rewardStopAtr:[0.5,5,0.1],rewardTakeAtr:[1,10,0.1]});
export function proposeP4DiagnosticChallenger({parent,diagnosticFinding}={}){
 const parameters=validateTrainingParameters(parent);
 const f=diagnosticFinding;
 if(!f||f.schemaVersion!=='P4_CAUSAL_FINDING_V1'||f.reviewStatus!=='VALIDATED'||f.quality!=='FAULT'||f.responsibility!=='PRIMARY'||f.actor!==OWNERS[f.parameter]||![-1,1].includes(f.direction)||!Number.isSafeInteger(f.supportingEvents)||f.supportingEvents<30||typeof f.evidenceId!=='string'||!f.evidenceId||typeof f.reason!=='string'||!f.reason.trim())return {status:'NO_VALIDATED_DIAGNOSTIC_UPDATE',parameters,appliedToModels:false};
 const [min,max,step]=SPECS[f.parameter];
 const proposed=Number((parameters[f.parameter]+step*f.direction).toFixed(8));
 if(proposed<min-1e-9||proposed>max+1e-9)return {status:'PARAMETER_BOUND_REACHED',parameters,appliedToModels:false};
 const next=validateTrainingParameters({...parameters,[f.parameter]:proposed});
 return {status:'CHALLENGER_PROPOSAL_ONLY',parameters:next,change:{actor:f.actor,parameter:f.parameter,from:parameters[f.parameter],to:proposed,evidenceId:f.evidenceId,supportingEvents:f.supportingEvents,reason:f.reason},requiresIndependentValidation:true,appliedToModels:false,promotionAllowed:false};
}
