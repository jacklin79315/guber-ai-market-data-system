import {createTrainingLedger} from './p4-training-ledger.mjs';
import {runP4ResearchIteration} from './p4-single-iteration.mjs';
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
// Bounded research loop only. No Champion promotion, persistence, or live orders.
// A research parent may change; the ledger Champion remains immutable.
export async function runP4ResearchCycle({championVersion,championParameters,iterations,seed,candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},otherReplayOptions={},shouldStop=()=>false,onIteration}={}){
 if(typeof championVersion!=='string'||!championVersion||!Number.isSafeInteger(iterations)||iterations<1||iterations>100||!Number.isSafeInteger(seed)||seed<0||typeof shouldStop!=='function'||(onIteration!==undefined&&typeof onIteration!=='function'))throw Error('invalid P4 research cycle configuration');
 let parentVersion=championVersion,parentParameters=validateTrainingParameters(championParameters);
 const ledger=createTrainingLedger({championVersion});
 const completed=[];
 for(let i=0;i<iterations;i++){
  if(shouldStop())break;
  const challengerVersion=championVersion+'-research-'+(i+1);
  const runId='research-round-'+(i+1);
  // The single iteration's comparison uses the provided parent version and parameters.
  const iterationLedger={...ledger,championVersion:parentVersion};
  const result=await runP4ResearchIteration({ledger:iterationLedger,runId,challengerVersion,seed,iteration:i,championParameters:parentParameters,candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions,otherReplayOptions});
  completed.push({iteration:i+1,runId,challengerVersion,candidate:result.candidate,feedback:result.feedback});
  if(result.feedback.proposedNextResearchParent===challengerVersion){
   parentVersion=challengerVersion;
   parentParameters=validateTrainingParameters(result.candidate.parameters);
  }
  if(onIteration)await onIteration(completed.at(-1));
 }
 return {status:completed.length===iterations?'RESEARCH_CYCLE_COMPLETED':'RESEARCH_CYCLE_STOPPED',championVersion:ledger.championVersion,researchParentVersion:parentVersion,completedIterations:completed.length,iterations:completed,ledger:structuredClone(ledger),independentValidation:false,promotionAllowed:false};
}
