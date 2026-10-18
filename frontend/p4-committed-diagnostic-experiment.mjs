// Bridge a durable P4 round's verified diagnostic task queue into a bounded OOS experiment.
// Explicit opt-in research call only; no automatic deployment trigger, trading or promotion.
import {inspectP4CommittedRound} from './p4-committed-round-inspection.mjs';
import {runP4DiagnosticOosExperiment} from './p4-diagnostic-oos-experiment.mjs';
export async function researchP4CommittedDiagnosticRound({store,jobId,round,parentParameters,trainCandles,validationCandles,maxArms=6,shouldStop=()=>false,taskId,side='challenger',...replayInputs}={}){
 if(side!=='champion'&&side!=='challenger')throw Error('invalid diagnostic research side');
 if(typeof shouldStop!=='function'||(taskId!==undefined&&(typeof taskId!=='string'||!taskId)))throw Error('invalid diagnostic research selection');
 if(['candles','onExperiment','onIteration','calibrationContract','minEvents'].some(key=>Object.hasOwn(replayInputs,key)))throw Error('committed research override forbidden');
 const inspection=await inspectP4CommittedRound({store,jobId,round});
 const tasks=inspection.nextResearchTasks.filter(t=>t.side===side&&t.id.startsWith('COLLECT_')&&t.id.endsWith('_CAUSAL_EVIDENCE')&&['Entry','Reward'].includes(t.actor));
 const selected=taskId?tasks.find(t=>t.id===taskId):tasks[0];
 if(!selected)return {schemaVersion:'P4_COMMITTED_DIAGNOSTIC_EXPERIMENT_V1',status:'NO_ELIGIBLE_DIAGNOSTIC_TASK',jobId,iteration:round.iteration,availableTasks:tasks.map(t=>t.id),mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 const experiment=await runP4DiagnosticOosExperiment({task:selected,parentParameters,trainCandles,validationCandles,maxArms,shouldStop,...replayInputs});
 return {schemaVersion:'P4_COMMITTED_DIAGNOSTIC_EXPERIMENT_V1',status:'EXPERIMENT_RESEARCH_COMPLETED',source:'IMMUTABLE_P4_ROUND',jobId,iteration:round.iteration,task:selected,experiment,mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
