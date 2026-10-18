// Audit training/OOS results without treating replay as independently validated learning.
export function extractP4DiagnosticLearningEvidence(result){
 const arm=result?.selectedArm;
 const feedback=result?.validationResult?.feedback;
 const selected=result?.trainingBatch?.results?.find(r=>r.arm?.parameter===arm?.parameter&&r.arm?.to===arm?.to);
 const train=selected?.feedback;
 const delta=f=>{const c=f?.champion?.netRealizedPnl,h=f?.challenger?.netRealizedPnl;return Number.isFinite(c)&&Number.isFinite(h)?h-c:null;};
 const trainDelta=delta(train),oosDelta=delta(feedback);
 const oosSufficient=feedback?.status==='RESEARCH_EVIDENCE_ONLY';
 return {schemaVersion:'P4_DIAGNOSTIC_LEARNING_EVIDENCE_V1',selectedParameter:arm?.parameter??null,from:arm?.from??null,to:arm?.to??null,trainingNetPnlDelta:trainDelta,oosNetPnlDelta:oosDelta,trainingImproved:trainDelta===null?null:trainDelta>0,oosImproved:oosDelta===null?null:oosDelta>0,oosSufficient,independentValidation:false,learnedModelUpdated:false,championPromotionAllowed:false,assessment:!arm?'NO_SELECTED_HYPOTHESIS':!oosSufficient?'INSUFFICIENT_OOS_EVIDENCE':oosDelta===null?'MISSING_COMPARABLE_OOS_PNL':oosDelta>0?'PROMISING_REQUIRES_INDEPENDENT_VALIDATION':'NO_OOS_IMPROVEMENT'};
}
