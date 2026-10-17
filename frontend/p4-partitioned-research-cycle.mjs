import {partitionP4ChronologicalCandles} from './p4-chronological-partition.mjs';
import {runP4ResearchCycle} from './p4-research-cycle.mjs';
// Partition once, then pass ONLY the research prefix to the adaptive cycle.
// This is a preparation guard, not a completed OOS validation.
export async function runP4PartitionedResearchCycle({candles,partitionOptions={},...cycleOptions}={}){
 if(partitionOptions===null||typeof partitionOptions!=='object'||Array.isArray(partitionOptions)||Object.hasOwn(partitionOptions,'candles'))throw Error('partition candles override forbidden');
 const partition=partitionP4ChronologicalCandles({...partitionOptions,candles});
 const extra=cycleOptions.otherReplayOptions??{};
 if(typeof extra!=='object'||['candles','validationCandles','trainingParameters','modelVersion','featureAtDecision','historyAtDecision','brain','costs','accountOptions'].some(k=>Object.hasOwn(extra,k)))throw Error('cannot override partitioned research candles or providers');
 const result=await runP4ResearchCycle({...cycleOptions,candles:partition.research});
 return {...result,partition:{schemaVersion:partition.schemaVersion,boundary:partition.boundary,researchCount:partition.researchCount,validationCount:partition.validationCount,validationUntouched:true},status:result.status,independentValidation:false,promotionAllowed:false,validationStatus:'RESERVED_NOT_EVALUATED'};
}
