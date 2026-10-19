import {partitionP4ChronologicalCandles} from './p4-chronological-partition.mjs';
import {runP4ResearchCycle} from './p4-research-cycle.mjs';
import {compareChallengerReplay} from './p4-challenger-comparison.mjs';
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
// Partition once, then pass ONLY the research prefix to the adaptive cycle.
// This is a preparation guard, not a completed OOS validation.
export async function runP4PartitionedResearchCycle({candles,partitionOptions={},...cycleOptions}={}){
 if(partitionOptions===null||typeof partitionOptions!=='object'||Array.isArray(partitionOptions)||Object.hasOwn(partitionOptions,'candles'))throw Error('partition candles override forbidden');
 const partition=partitionP4ChronologicalCandles({...partitionOptions,candles});
 const extra=cycleOptions.otherReplayOptions??{};
 if(typeof extra!=='object'||['candles','validationCandles','trainingParameters','modelVersion','featureAtDecision','historyAtDecision','brain','costs','accountOptions'].some(k=>Object.hasOwn(extra,k)))throw Error('cannot override partitioned research candles or providers');
 const result=await runP4ResearchCycle({...cycleOptions,candles:partition.research});
 const frozen=result.iterations.at(-1);
 if(result.status!=='RESEARCH_CYCLE_COMPLETED'||!frozen||!cycleOptions.championParameters)return {...result,partition:{schemaVersion:partition.schemaVersion,boundary:partition.boundary,researchCount:partition.researchCount,validationCount:partition.validationCount,validationUntouched:true},independentValidation:false,promotionAllowed:false,validationStatus:'RESERVED_NOT_EVALUATED'};
 // Freeze the research-selected candidate before evaluating untouched future candles.
 const selected=result.researchParentVersion;
 if(typeof selected!=='string'||!selected)throw Error('P4 OOS selected research version missing');
 if(selected!==cycleOptions.championVersion&&!result.iterations.some(x=>x.challengerVersion===selected))throw Error('P4 OOS selected version was not produced in research prefix');
 const parameters=selected===cycleOptions.championVersion?validateTrainingParameters(cycleOptions.championParameters):validateTrainingParameters(result.iterations.find(x=>x.challengerVersion===selected)?.candidate?.parameters);
 const oos=await compareChallengerReplay({candles:partition.validation,featureAtDecision:cycleOptions.featureAtDecision,historyAtDecision:cycleOptions.historyAtDecision,brain:cycleOptions.brain,costs:cycleOptions.costs,accountOptions:cycleOptions.accountOptions,otherReplayOptions:extra,champion:{version:cycleOptions.championVersion,parameters:cycleOptions.championParameters},challenger:{version:selected+'-oos-frozen',parameters}});
 const metrics={champion:oos.champion.metrics,selected:oos.challenger.metrics};
 const minClosedTrades=30;
 const validationMidpointMs=partition.validation[Math.floor(partition.validation.length/2)].closeTime;
 const validationEarly=partition.validation.slice(0,Math.floor(partition.validation.length/2));
 const validationLate=partition.validation.slice(Math.floor(partition.validation.length/2));
 const earlyReplay=await compareChallengerReplay({candles:validationEarly,featureAtDecision:cycleOptions.featureAtDecision,historyAtDecision:cycleOptions.historyAtDecision,brain:cycleOptions.brain,costs:cycleOptions.costs,accountOptions:cycleOptions.accountOptions,otherReplayOptions:extra,champion:{version:cycleOptions.championVersion,parameters:cycleOptions.championParameters},challenger:{version:selected+'-early',parameters}});
 const lateReplay=await compareChallengerReplay({candles:validationLate,featureAtDecision:cycleOptions.featureAtDecision,historyAtDecision:cycleOptions.historyAtDecision,brain:cycleOptions.brain,costs:cycleOptions.costs,accountOptions:cycleOptions.accountOptions,otherReplayOptions:extra,champion:{version:cycleOptions.championVersion,parameters:cycleOptions.championParameters},challenger:{version:selected+'-late',parameters}});
 const sufficient=metrics.champion.closedTrades>=minClosedTrades&&metrics.selected.closedTrades>=minClosedTrades;
 return {...result,partition:{schemaVersion:partition.schemaVersion,boundary:partition.boundary,researchCount:partition.researchCount,validationCount:partition.validationCount,validationUntouched:true},independentValidation:true,promotionAllowed:false,validationStatus:sufficient?'OOS_EVALUATED':'OOS_INSUFFICIENT_CLOSED_TRADES',oosEvaluation:{validationMidpointMs,timeWindowDiagnostics:[{window:'EARLY',champion:earlyReplay.champion.metrics,selected:earlyReplay.challenger.metrics},{window:'LATE',champion:lateReplay.champion.metrics,selected:lateReplay.challenger.metrics}],selectedVersion:selected,selectedBeforeOos:true,processedCandles:oos.challenger.processedCandles,metrics,minClosedTrades,sufficient,improvedNetPnl:sufficient?metrics.selected.netRealizedPnl>metrics.champion.netRealizedPnl:null,warning:'Untouched chronological holdout; research-only comparison, never automatic promotion.'}};
}
