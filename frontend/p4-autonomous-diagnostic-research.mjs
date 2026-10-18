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
