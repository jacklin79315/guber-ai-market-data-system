import {partitionP4ChronologicalCandles} from './p4-chronological-partition.mjs';
import {runP4PatternResearch} from './p4-pattern-research.mjs';
import {evaluateP4FrozenOOS} from './p4-frozen-oos.mjs';
// Research on chronological prefix only. Freeze the best eligible candidate
// before touching the held-out suffix. No automatic promotion.
export async function runP4PatternResearchThenOOS({candles,partitionOptions={},plan,parentVersion,parentParameters,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},otherReplayOptions={},minClosedTrades=30}={}){
 if(!partitionOptions||typeof partitionOptions!=='object'||Array.isArray(partitionOptions)||Object.hasOwn(partitionOptions,'candles'))throw Error('partition override forbidden');
 const partition=partitionP4ChronologicalCandles({...partitionOptions,candles});
 const research=await runP4PatternResearch({plan,parentVersion,parentParameters,candles:partition.research,featureAtDecision,historyAtDecision,brain,costs,accountOptions,otherReplayOptions,minClosedTrades});
 const eligible=research.results.filter(r=>r.feedback.improvedInSameWindow&&r.feedback.status==='RESEARCH_EVIDENCE_ONLY');
 if(!eligible.length)return {schemaVersion:'P4_PATTERN_RESEARCH_OOS_V1',status:'NO_ELIGIBLE_CHALLENGER_OOS_UNTOUCHED',research,partition:{boundary:partition.boundary,researchCount:partition.researchCount,validationCount:partition.validationCount},independentValidationPassed:false,promotionAllowed:false};
 eligible.sort((a,b)=>(b.feedback.challenger.netRealizedPnl-b.feedback.champion.netRealizedPnl)-(a.feedback.challenger.netRealizedPnl-a.feedback.champion.netRealizedPnl)||a.challengerVersion.localeCompare(b.challengerVersion));
 const winner=eligible[0];
 const evaluation=await evaluateP4FrozenOOS({researchBoundary:partition.boundary,validationCandles:partition.validation,champion:{version:parentVersion,parameters:parentParameters},challenger:{version:winner.challengerVersion,parameters:winner.parameters},featureAtDecision,historyAtDecision,brain,costs,accountOptions,otherReplayOptions});
 return {schemaVersion:'P4_PATTERN_RESEARCH_OOS_V1',status:'OOS_EVALUATION_COMPLETED_REVIEW_REQUIRED',research,selectedChallenger:{version:winner.challengerVersion,parameters:winner.parameters,evidenceId:winner.evidenceId},evaluation,partition:{boundary:partition.boundary,researchCount:partition.researchCount,validationCount:partition.validationCount},independentValidationPassed:false,promotionAllowed:false};
}
