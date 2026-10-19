import {runP4PartitionedResearchCycle} from './p4-partitioned-research-cycle.mjs';
// Paired research experiment: identical inputs and seed, differing only in diagnostic guidance.
// No automatic promotion or live orders. OOS is reported only after both arms finish.
export async function compareP4GuidanceModes(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.hasOwn(options,'explorationMode')||Object.hasOwn(options,'resumeRounds')||Object.hasOwn(options,'onIteration'))throw Error('invalid P4 guidance experiment options');
 const guided=await runP4PartitionedResearchCycle({...options,explorationMode:'DIAGNOSTIC_GUIDED'});
 const unguided=await runP4PartitionedResearchCycle({...options,explorationMode:'UNGUIDED'});
 const comparable=guided.validationStatus==='OOS_EVALUATED'&&unguided.validationStatus==='OOS_EVALUATED'&&guided.partition?.boundary?.validationStartMs===unguided.partition?.boundary?.validationStartMs;
 const g=guided.oosEvaluation?.metrics?.selected,u=unguided.oosEvaluation?.metrics?.selected;
 return {schemaVersion:'P4_GUIDANCE_AB_COMPARISON_V1',guided,unguided,comparable,comparisonStatus:comparable?'OOS_COMPARABLE':'INSUFFICIENT_OOS_EVIDENCE',selectedOosNetPnlDifference:comparable?g.netRealizedPnl-u.netRealizedPnl:null,independentValidation:comparable,promotionAllowed:false,warning:'A single paired OOS comparison does not establish statistical significance, profitability or autonomous promotion.'};
}
