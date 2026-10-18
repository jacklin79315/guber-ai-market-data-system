// Execute a single diagnostic hypothesis against identical historical replay inputs.
// Exploratory in-sample evidence only; never a causal finding or Champion promotion.
import {compareChallengerReplay} from './p4-challenger-comparison.mjs';
import {assessP4ResearchFeedback} from './p4-research-feedback.mjs';
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
export async function replayP4DiagnosticArm({arm,taskId,parentVersion='diagnostic-parent',candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},otherReplayOptions={}}={}){
 if(!arm||typeof taskId!=='string'||!taskId||typeof parentVersion!=='string'||!parentVersion||typeof arm.parameter!=='string'||![-1,1].includes(arm.direction)||!Number.isFinite(arm.from)||!Number.isFinite(arm.to)||arm.from===arm.to)throw Error('invalid diagnostic experiment arm');
 const candidate=validateTrainingParameters(arm.parameters);
 if(candidate[arm.parameter]!==arm.to)throw Error('diagnostic arm parameter mismatch');
 const comparison=await compareChallengerReplay({candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions,otherReplayOptions,champion:{version:parentVersion,parameters:validateTrainingParameters({...candidate,[arm.parameter]:arm.from})},challenger:{version:parentVersion+'-diagnostic-'+arm.parameter+'-'+(arm.direction>0?'up':'down'),parameters:candidate}});
 const feedback=assessP4ResearchFeedback({comparison});
 return {schemaVersion:'P4_DIAGNOSTIC_ARM_REPLAY_V1',taskId,arm:{parameter:arm.parameter,direction:arm.direction,from:arm.from,to:arm.to},comparison,feedback,status:'EXPLORATORY_REPLAY_COMPLETED',mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false,independentValidation:false};
}
