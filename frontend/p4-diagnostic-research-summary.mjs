// Small, serializable audit envelope. Full replay diagnostics remain in memory unless
// an explicitly configured durable research writer stores this summary.
export function summarizeP4DiagnosticResearch({result,jobId,createdAtMs}={}){
 if(!result||typeof result.status!=='string'||typeof jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(jobId)||!Number.isSafeInteger(createdAtMs)||createdAtMs<0)throw Error('invalid P4 diagnostic research summary');
 const batch=result.trainingBatch;
 const validationStatus=!result.oosReplayEvaluated?'NOT_EVALUATED':result.validationResult?.feedback?.status==='INSUFFICIENT_RESEARCH_SAMPLES'?'INSUFFICIENT_OOS_SAMPLES':result.oosImprovedInReplay===true?'OOS_IMPROVED_RESEARCH_ONLY':'OOS_NOT_IMPROVED';
 const compactFeedback=f=>f?{status:f.status,champion:f.champion,challenger:f.challenger,improvedInSameWindow:f.improvedInSameWindow}:null;
 return {schemaVersion:'P4_DIAGNOSTIC_RESEARCH_SUMMARY_V1',jobId,createdAtMs,status:result.status,source:result.source??null,loadedCandles:result.loadedCandles??null,trainWindow:result.trainWindow??null,validationWindow:result.validationWindow??null,partition:result.partition??null,taskId:batch?.taskId??null,plannedArms:batch?.plannedArms??0,completedArms:batch?.completedArms??0,trainingResults:batch?.results?.map(x=>({arm:x.arm,feedback:compactFeedback(x.feedback)}))??[],selectedArm:result.selectedArm??null,validationFeedback:compactFeedback(result.validationResult?.feedback),oosReplayEvaluated:result.oosReplayEvaluated===true,oosEvidenceStatus:validationStatus,oosImprovedInReplay:result.oosImprovedInReplay===true,independentValidation:false,independentValidationPassed:false,modelUpdateApplied:false,championPromotionAllowed:false,ordersEnabled:false};
}
