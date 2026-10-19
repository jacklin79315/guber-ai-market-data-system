// Research-only diagnostic hypothesis orchestrator. No orders, parameter application or promotion.
import {planP4LearningFromDiagnostics} from './p4-diagnostic-learning-gate.mjs';
import {discoverP4DiagnosticPatterns} from './p4-diagnostic-patterns.mjs';
import {reassessP4PersistedDiagnostics} from './p4-persisted-diagnostic-reassessment.mjs';
import {summarizeP4ExpertReliability} from './p4-expert-reliability-research.mjs';
import {checkP4CalibrationEligibility} from './p4-calibration-eligibility.mjs';
import {evaluateP4PersistedWinCalibration} from './p4-persisted-win-calibration.mjs';

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

/**
 * Read immutable P4 diagnostic artifacts using the existing SHA256/manifest
 * verified store, then produce research-only readiness reports.
 * The store must be constructed by createP4ArtifactChunkStore.
 */
export async function inspectPersistedP4ResearchRound({store,jobId,iteration,manifests,minEvents=30,calibrationContract}={}){
 if(!store||typeof store.read!=='function'||typeof jobId!=='string'||!jobId||!Number.isSafeInteger(iteration)||iteration<1||!manifests||typeof manifests!=='object')throw Error('invalid P4 research round reference');
 const results={};
 for(const [label,kind] of [['champion','CHAMPION_DIAGNOSTICS'],['challenger','CHALLENGER_DIAGNOSTICS']]){
  // Persisted rounds store manifests under champion/challenger; accept legacy kind keys for compatibility.
  const manifest=manifests[label]??manifests[kind];
  if(!manifest)throw Error('missing immutable diagnostic manifest: '+kind);
  const records=await store.read({jobId,iteration,kind,manifest});
  const reassessment=reassessP4PersistedDiagnostics({records});
  results[label]={...inspectPersistedP4DiagnosticReadiness({records,minEvents}),reassessment:{schemaVersion:reassessment.schemaVersion,sourceRecords:reassessment.sourceRecords,outcomes:reassessment.outcomes,byOutcome:reassessment.byOutcome,before:reassessment.before,after:reassessment.after,addedByActor:reassessment.addedByActor,attributionAfter:reassessment.attributionAfter,missingAfter:reassessment.missingAfter,modelUpdateApplied:false},evidenceGaps:prioritizeP4DiagnosticEvidenceGaps({records}),decisionInputs:inspectP4DecisionInputCoverage({records}),calibrationEligibility:checkP4CalibrationEligibility(records,minEvents),calibrationResearch:calibrationContract?evaluateP4PersistedWinCalibration({records,contract:calibrationContract}):null,researchTasks:planP4EvidenceResearchTasks({records,minEvents}),expertReliability:summarizeP4ExpertReliability({records,minReviewed:minEvents})};
 }
 return {schemaVersion:'P4_PERSISTED_RESEARCH_READINESS_V1',mode:'RESEARCH_ONLY',liveTrading:false,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,jobId,iteration,results};
}

/**
 * Autonomous diagnostic coverage triage, independent of realized PnL.
 * Prioritizes missing evidence collection rather than guessing a parameter.
 */
export function prioritizeP4DiagnosticEvidenceGaps({records}={}){
 if(!Array.isArray(records))throw Error('invalid diagnostic records');
 const actors=['Entry','Reward','Win','Risk','Time','Brain'];
 const gaps=Object.fromEntries(actors.map(actor=>[actor,0]));
 let complete=0;
 for(const row of records){
  const d=row?.diagnosis;
  if(d?.schemaVersion!=='P4_DIAGNOSIS_V1'||!Array.isArray(d.unassessedActors)||!Array.isArray(d.attribution))throw Error('invalid diagnostic record');
  if(d.unassessedActors.some(actor=>!actors.includes(actor)))throw Error('unknown diagnostic actor');
  for(const actor of new Set(d.unassessedActors))gaps[actor]++;
  if(d.requiresReview===false)complete++;
 }
 const priorities=Object.entries(gaps).map(([actor,missing])=>({actor,missing,coverage:records.length?Number(((records.length-missing)/records.length).toFixed(4)):null})).sort((a,b)=>b.missing-a.missing||a.actor.localeCompare(b.actor));
 return {schemaVersion:'P4_DIAGNOSTIC_EVIDENCE_GAPS_V1',mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,totalEvents:records.length,fullyReviewed:complete,priorities,nextAction:records.length===0?'COLLECT_DIAGNOSTIC_EVIDENCE':priorities[0]?.missing>0?'IMPROVE_CAUSAL_EVIDENCE_COVERAGE':'REVIEW_VALIDATED_CAUSAL_HYPOTHESES'};
}

/**
 * Identify missing or explicitly unknown decision-time inputs. These are
 * research priorities, not retrospective blame or evidence of bad trades.
 */
export function inspectP4DecisionInputCoverage({records}={}){
 if(!Array.isArray(records))throw Error('invalid diagnostic records');
 const keys=['proposalAtDecision','expertHistory','accountAtDecision','riskDiagnostics'];
 const missing=Object.fromEntries(keys.map(k=>[k,0]));
 let unknownProbability=0,unknownExpectedValue=0,approvedWithUnknownProbability=0;
 for(const row of records){
  if(row?.diagnosis?.schemaVersion!=='P4_DIAGNOSIS_V1'||!row.evidence||typeof row.evidence!=='object')throw Error('invalid diagnostic evidence');
  const e=row.evidence,p=e.proposalAtDecision;
  for(const key of keys)if(e[key]==null)missing[key]++;
  if(p&&typeof p==='object'){
   if(p.winProbability==null){unknownProbability++;if(e.action==='APPROVE')approvedWithUnknownProbability++;}
   if(p.expectedValue==null)unknownExpectedValue++;
  }
 }
 const count=records.length;
 return {schemaVersion:'P4_DECISION_INPUT_COVERAGE_V1',mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,totalEvents:count,missing,unknownProbability,unknownExpectedValue,approvedWithUnknownProbability,notes:'Unknown probability in explicit exploration mode is not automatically a decision fault; collect calibration evidence before assigning blame.'};
}

/**
 * Deterministic, bounded research queue derived solely from observed evidence.
 * Tasks are diagnostic investigations, never executable parameter changes.
 */
export function planP4EvidenceResearchTasks({records,minEvents=30}={}){
 if(!Array.isArray(records)||!Number.isSafeInteger(minEvents)||minEvents<2)throw Error('invalid research evidence');
 const coverage=prioritizeP4DiagnosticEvidenceGaps({records});
 const inputs=inspectP4DecisionInputCoverage({records});
 const tasks=[];
 if(records.length===0)tasks.push({id:'COLLECT_DIAGNOSTIC_RECORDS',priority:'BLOCKING',sampleCount:0,actor:null,question:'Collect immutable, independently auditable replay diagnoses'});
 else{
  if(inputs.unknownProbability>0)tasks.push({id:'CALIBRATE_UNKNOWN_WIN_PROBABILITY',priority:'HIGH',sampleCount:inputs.unknownProbability,actor:'Win',question:'Evaluate probability calibration using strictly past closed simulated trades; keep uncalibrated exploration separate'});
  if(inputs.unknownExpectedValue>0)tasks.push({id:'AUDIT_UNKNOWN_EXPECTED_VALUE',priority:'HIGH',sampleCount:inputs.unknownExpectedValue,actor:'Reward',question:'Verify decision-time expected value availability without hindsight or invented win probabilities'});
  for(const gap of coverage.priorities.filter(g=>g.missing>0))tasks.push({id:'COLLECT_'+gap.actor.toUpperCase()+'_CAUSAL_EVIDENCE',priority:'MEDIUM',sampleCount:gap.missing,actor:gap.actor,question:'Collect independent decision-time evidence and counterfactual checks for '+gap.actor+'; do not infer fault from PnL'});
 }
 return {schemaVersion:'P4_EVIDENCE_RESEARCH_TASKS_V1',mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,minimumCausalEvents:minEvents,taskCount:tasks.length,tasks};
}
