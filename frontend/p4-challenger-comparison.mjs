import {collectP4DiagnosticEvidence} from './p4-diagnostic-evidence.mjs';
import {runSequentialFiveExpertReplay} from './p3-sequential-replay.mjs';
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
// Run two isolated paper simulations on exactly the same closed candles and decision providers.
// These are research results, NOT independent validation unless a separate untouched window is supplied.
export async function compareChallengerReplay({candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},champion,challenger,otherReplayOptions={}}={}){
 if(!Array.isArray(candles)||candles.length===0||typeof featureAtDecision!=='function'||typeof brain!=='function'||!costs||!champion||!challenger||typeof champion.version!=='string'||!champion.version||typeof challenger.version!=='string'||!challenger.version||champion.version===challenger.version)throw Error('invalid challenger comparison');
 const championParams=validateTrainingParameters(champion.parameters),challengerParams=validateTrainingParameters(challenger.parameters);
 const shared={candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions,...otherReplayOptions};
 // Explicitly override any accidental model/parameter overrides in shared options.
 const [championResult,challengerResult]=await Promise.all([
  runSequentialFiveExpertReplay({...shared,trainingParameters:championParams,modelVersion:champion.version}),
  runSequentialFiveExpertReplay({...shared,trainingParameters:challengerParams,modelVersion:challenger.version})
 ]);
 const summarize=(version,r)=>({version,processedCandles:r.processedCandles,statistics:r.statistics,metrics:r.metrics,initialCapital:r.account.initialCapital,closedTrades:r.account.closed.length});
 const diagnosticEvidence={champion:collectP4DiagnosticEvidence(championResult),challenger:collectP4DiagnosticEvidence(challengerResult)};
 return {diagnosticEvidence,status:'RESEARCH_COMPARISON_ONLY',independentValidation:false,promotionAllowed:false,champion:summarize(champion.version,championResult),challenger:summarize(challenger.version,challengerResult),controls:{sameCandles:true,sameCosts:true,sameInitialCapital:true,sameBrainProvider:true,sameFeatureProvider:true},warning:'Same-window comparisons are not independent out-of-sample evidence. No promotion is authorized.'};
}
