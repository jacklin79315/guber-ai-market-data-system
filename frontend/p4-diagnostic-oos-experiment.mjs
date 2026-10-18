// Two-window diagnostic experiment: select on earlier training candles, evaluate
// the selected arm once on later untouched candles. Research-only, no promotion.
import {runP4DiagnosticExperiments} from './p4-diagnostic-experiment-runner.mjs';
import {replayP4DiagnosticArm} from './p4-diagnostic-arm-replay.mjs';
export async function runP4DiagnosticOosExperiment({task,parentParameters,trainCandles,validationCandles,maxArms=6,shouldStop=()=>false,...replayInputs}={}){
 if(!Array.isArray(trainCandles)||trainCandles.length<2||!Array.isArray(validationCandles)||validationCandles.length<2||typeof shouldStop!=='function')throw Error('invalid P4 diagnostic OOS windows');
 const interval=rows=>{
  let previous=-Infinity;
  for(const row of rows){if(!Number.isSafeInteger(row?.closeTime)||row.closeTime<=previous)throw Error('unordered or invalid P4 OOS candles');previous=row.closeTime;}
  return {from:rows[0].closeTime,to:rows.at(-1).closeTime};
 };
 const train=interval(trainCandles),validation=interval(validationCandles);
 if(train.to>=validation.from)throw Error('P4 diagnostic OOS windows overlap or are noncausal');
 const batch=await runP4DiagnosticExperiments({task,parentParameters,maxArms,shouldStop,candles:trainCandles,...replayInputs});
 const eligible=batch.status==='EXPLORATORY_BATCH_COMPLETED'?batch.results.filter(r=>r.feedback?.status==='RESEARCH_EVIDENCE_ONLY'&&r.feedback.improvedInSameWindow===true):[];
 eligible.sort((a,b)=>(b.feedback.challenger.netRealizedPnl-b.feedback.champion.netRealizedPnl)-(a.feedback.challenger.netRealizedPnl-a.feedback.champion.netRealizedPnl)||a.arm.parameter.localeCompare(b.arm.parameter)||a.arm.direction-b.arm.direction);
 const selected=eligible[0]??null;
 const validationResult=selected&&!shouldStop()?await replayP4DiagnosticArm({taskId:batch.taskId,arm:{...selected.arm,parameters:{...parentParameters,[selected.arm.parameter]:selected.arm.to}},candles:validationCandles,...replayInputs}):null;
 return {schemaVersion:'P4_DIAGNOSTIC_OOS_EXPERIMENT_V1',status:validationResult?'OOS_RESEARCH_EVALUATED':batch.status==='EXPLORATORY_BATCH_STOPPED'?'STOPPED':'NO_TRAIN_SELECTED_ARM',trainWindow:train,validationWindow:validation,trainingBatch:batch,selectedArm:selected?.arm??null,validationResult,independentValidation:validationResult!==null,independentValidationPassed:validationResult?.feedback?.status==='RESEARCH_EVIDENCE_ONLY'&&validationResult.feedback.improvedInSameWindow===true,mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
