// Research-only diagnostic hypothesis orchestrator. No orders, parameter application or promotion.
import {planP4LearningFromDiagnostics} from './p4-diagnostic-learning-gate.mjs';
import {discoverP4DiagnosticPatterns} from './p4-diagnostic-patterns.mjs';

export function planAutonomousP4DiagnosticResearch({audit,parentParameters,causalFindings=[]}={}){
 if(!Array.isArray(causalFindings))throw Error('causalFindings must be an array');
 const proposals=causalFindings.map(finding=>planP4LearningFromDiagnostics({audit,parentParameters,causalFinding:finding}));
 return {schemaVersion:'P4_AUTONOMOUS_DIAGNOSTIC_RESEARCH_V1',mode:'RESEARCH_ONLY',liveTrading:false,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,proposals,readyForIndependentValidation:proposals.some(p=>p.status==='CHALLENGER_PROPOSAL_ONLY')};
}

// Autonomous evidence discovery: recurring diagnostic faults are hypotheses, never proven causes.
export function discoverAutonomousP4ResearchHypotheses({rows,minEvents=30}={}){
 const report=discoverP4DiagnosticPatterns({rows,minEvents});
 return {schemaVersion:'P4_AUTONOMOUS_HYPOTHESES_V1',mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,auditFingerprint:report.auditFingerprint,unresolvedEvents:report.unresolvedEvents,hypotheses:report.patterns.filter(p=>p.status==='HYPOTHESIS_FOR_CAUSAL_REVIEW'),pendingEvidence:report.patterns.filter(p=>p.status==='INSUFFICIENT_PATTERN_SAMPLES')};
}

/**
 * Evaluate reconstructed persisted diagnostic records. Fragment envelopes must
 * be reassembled and integrity-checked by the artifact reader before this call.
 * Never infer expert fault from PnL or treat unresolved diagnoses as validated.
 */
export function inspectPersistedP4DiagnosticReadiness({records,minEvents=30}={}){
 if(!Array.isArray(records)||!Number.isSafeInteger(minEvents)||minEvents<2)throw Error('invalid persisted diagnostic inputs');
 if(records.some(r=>r?.__p4_fragment_v1===true||r?.diagnosis?.schemaVersion!=='P4_DIAGNOSIS_V1'||r?.feedback?.schemaVersion!=='P4_FEEDBACK_V1'))throw Error('diagnostic records must be fully reconstructed and validated');
 const reviewCount=records.filter(r=>r.diagnosis.requiresReview===true).length;
 const report=discoverAutonomousP4ResearchHypotheses({rows:records,minEvents});
 return {schemaVersion:'P4_DIAGNOSTIC_READINESS_V1',mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,totalEvents:records.length,requiresReview:reviewCount,readyForCausalLearning:reviewCount===0&&report.hypotheses.length>0,reason:reviewCount>0?'UNRESOLVED_DIAGNOSIS':report.hypotheses.length===0?'NO_SUPPORTED_FAULT_PATTERN':'HYPOTHESES_REQUIRE_CAUSAL_VALIDATION',report};
}
