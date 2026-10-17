import {proposeP4DiagnosticChallenger} from './p4-diagnostic-challenger.mjs';
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
// Keep the missing causal attribution explicit. A diagnostic summary cannot
// identify which parameter to change or whether increasing it helps.
export function planP4LearningFromDiagnostics({audit,parentParameters,causalFinding=null}={}){
 const parent=validateTrainingParameters(parentParameters);
 if(audit?.schemaVersion!=='P4_DIAGNOSTIC_AUDIT_V1'||!Number.isSafeInteger(audit.eventCount)||audit.eventCount<0||!audit.actors||audit.appliedToModels!==false)throw Error('invalid diagnostic provenance');
 if(audit.requiresReview>0)return {status:'BLOCKED_UNRESOLVED_DIAGNOSIS',parameters:parent,updateApplied:false,promotionAllowed:false};
 if(!causalFinding)return {status:'BLOCKED_MISSING_CAUSAL_PARAMETER_ATTRIBUTION',parameters:parent,updateApplied:false,promotionAllowed:false};
 // The finding must be backed by this exact audit, not an arbitrary VALIDATED label.
 if(causalFinding.auditFingerprint!==audit.fingerprint||typeof audit.fingerprint!=='string'||!audit.fingerprint||causalFinding.supportingEvents>audit.eventCount)return {status:'BLOCKED_UNVERIFIED_AUDIT_LINK',parameters:parent,updateApplied:false,promotionAllowed:false};
 const proposal=proposeP4DiagnosticChallenger({parent,diagnosticFinding:causalFinding});
 return {...proposal,updateApplied:false,promotionAllowed:false,provenance:'EXTERNAL_CAUSAL_FINDING_REQUIRES_INDEPENDENT_REVIEW'};
}
