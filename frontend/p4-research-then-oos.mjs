import {partitionP4ChronologicalCandles} from './p4-chronological-partition.mjs';
import {runP4ResearchCycle} from './p4-research-cycle.mjs';
import {evaluateP4FrozenOOS} from './p4-frozen-oos.mjs';
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
// Explicit, one-shot research -> freeze -> OOS evaluation. Never feeds OOS metrics
// back into the research parent or performs automatic Champion promotion.
export async function runP4ResearchThenOOS({candles,partitionOptions={},championVersion,championParameters,iterations,seed,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},otherReplayOptions={},shouldStop=()=>false,onIteration}={}){
 const partition=partitionP4ChronologicalCandles({candles,...partitionOptions});
 if(otherReplayOptions.candles||otherReplayOptions.trainingParameters||otherReplayOptions.modelVersion||otherReplayOptions.validationCandles)throw Error('research/OOS override forbidden');
 const research=await runP4ResearchCycle({championVersion,championParameters,iterations,seed,candles:partition.research,featureAtDecision,historyAtDecision,brain,costs,accountOptions,otherReplayOptions,shouldStop,onIteration});
 if(research.status!=='RESEARCH_CYCLE_COMPLETED'||shouldStop())return {status:'RESEARCH_INCOMPLETE_NO_OOS',research,partition:{boundary:partition.boundary,researchCount:partition.researchCount,validationCount:partition.validationCount},independentValidationPassed:false,promotionAllowed:false};
 const last=research.iterations.at(-1);
 // Research parent can be an earlier candidate; select its exact archived parameter set.
 const selected=research.researchParentVersion===championVersion?{version:championVersion,parameters:validateTrainingParameters(championParameters)}:(()=>{const round=research.iterations.find(r=>r.challengerVersion===research.researchParentVersion);if(!round?.candidate?.parameters)throw Error('selected research parent missing archived parameters');return {version:round.challengerVersion,parameters:validateTrainingParameters(round.candidate.parameters)}})();
 if(selected.version===championVersion)return {status:'NO_CHALLENGER_SELECTED',research,partition:{boundary:partition.boundary,researchCount:partition.researchCount,validationCount:partition.validationCount},independentValidationPassed:false,promotionAllowed:false};
 const evaluation=await evaluateP4FrozenOOS({researchBoundary:partition.boundary,validationCandles:partition.validation,champion:{version:championVersion,parameters:championParameters},challenger:selected,featureAtDecision,historyAtDecision,brain,costs,accountOptions,otherReplayOptions});
 return {status:'OOS_EVALUATION_COMPLETED_REVIEW_REQUIRED',research,evaluation,selectedChallenger:{version:selected.version,parameters:selected.parameters},partition:{boundary:partition.boundary,researchCount:partition.researchCount,validationCount:partition.validationCount},independentValidationPassed:false,promotionAllowed:false};
}
