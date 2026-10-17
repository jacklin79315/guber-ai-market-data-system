import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
// Diagnostic-directed proposal planning, not a model update.
// A hard-cap violation concerns Risk's allocation policy, which is not among
// the five currently trainable Entry/Reward parameters. Never mutate an
// unrelated parameter merely to claim diagnostic-driven learning.
export function planP4DiagnosticUpdate({audit,parentParameters}={}){
 const parent=validateTrainingParameters(parentParameters);
 if(audit?.schemaVersion!=='P4_DIAGNOSTIC_AUDIT_V1'||!audit.actors||!Number.isSafeInteger(audit.eventCount)||audit.eventCount<0)throw Error('invalid diagnostic audit');
 const risk=audit.actors.Risk;
 if(!risk||!Number.isFinite(risk.weightedNegative)||risk.weightedNegative<0)throw Error('invalid risk feedback');
 const findings=[];
 if(risk.negative>0)findings.push({actor:'Risk',finding:'PORTFOLIO_HARD_CAP_BREACH',count:risk.negative,priority:'BLOCKING',requiredChange:'Risk allocation policy / account-cap guard',trainableParameter:null});
 return {schemaVersion:'P4_DIAGNOSTIC_UPDATE_PLAN_V1',status:findings.length?'BLOCKED_UNSUPPORTED_PARAMETER':'INSUFFICIENT_ATTRIBUTABLE_FEEDBACK',findings,parentParameters:parent,proposedParameters:null,updateApplied:false,independentValidation:false,reason:findings.length?'Current trainable parameters only cover Entry and Reward; a Risk hard-cap violation must not mutate unrelated parameters.':'No evidence-backed parameter-level attribution is available yet.'};
}
