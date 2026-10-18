// Bounded execution of diagnostic hypotheses through the existing five-expert paper replay.
// Never updates Champion or submits live orders; no independent OOS claim.
import {proposeP4DiagnosticExperimentArms} from './p4-diagnostic-experiment-candidates.mjs';
import {replayP4DiagnosticArm} from './p4-diagnostic-arm-replay.mjs';
export async function runP4DiagnosticExperiments({task,parentParameters,maxArms=6,explorationSteps=[1],shouldStop=()=>false,onExperiment,...replayInputs}={}){
 if(typeof shouldStop!=='function'||(onExperiment!==undefined&&typeof onExperiment!=='function'))throw Error('invalid diagnostic experiment callbacks');
 const proposal=proposeP4DiagnosticExperimentArms({task,parentParameters,maxArms,explorationSteps});
 const completed=[];
 for(const arm of proposal.arms){
  if(shouldStop())break;
  const result=await replayP4DiagnosticArm({...replayInputs,arm,taskId:proposal.taskId});
  completed.push({arm:result.arm,feedback:result.feedback,comparison:result.comparison});
  await onExperiment?.(completed.at(-1));
 }
 return {schemaVersion:'P4_DIAGNOSTIC_EXPERIMENT_BATCH_V1',status:completed.length===proposal.arms.length?'EXPLORATORY_BATCH_COMPLETED':'EXPLORATORY_BATCH_STOPPED',taskId:proposal.taskId,plannedArms:proposal.arms.length,completedArms:completed.length,results:completed,mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,independentValidation:false};
}
