import {generateChallengerParameters,validateTrainingParameters} from './p4-challenger-parameters.mjs';
import {registerTrainingRun,completeTrainingRun,trainingLedgerSnapshot} from './p4-training-ledger.mjs';
import {compareChallengerReplay} from './p4-challenger-comparison.mjs';
import {assessP4ResearchFeedback} from './p4-research-feedback.mjs';
// Single research iteration only: create, replay, archive. Never auto-promote or trade live.
export async function runP4ResearchIteration({ledger,runId,challengerVersion,seed,iteration=0,preferredActor=null,directedProbe=null,visitedParameterSets=[],championParameters,candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},otherReplayOptions={}}={}){
 if(!ledger||typeof ledger.championVersion!=='string'||!Array.isArray(candles)||candles.length<2||typeof runId!=='string'||!runId||typeof challengerVersion!=='string'||!challengerVersion)throw Error('invalid P4 iteration inputs');
 const parent=validateTrainingParameters(championParameters);
 const candidate=generateChallengerParameters({parent,seed,iteration,preferredActor,directedProbe,visitedParameterSets});
 const start=candles[0]?.closeTime,end=candles.at(-1)?.closeTime;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=end)throw Error('invalid P4 data interval');
 registerTrainingRun(ledger,{runId,parentVersion:ledger.championVersion,challengerVersion,dataStartMs:start,dataEndMs:end,parameters:candidate.parameters,seed});
 try{
  const comparison=await compareChallengerReplay({candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions,champion:{version:ledger.championVersion,parameters:parent},challenger:{version:challengerVersion,parameters:candidate.parameters},otherReplayOptions});
  const feedback=assessP4ResearchFeedback({comparison});
  completeTrainingRun(ledger,{runId,status:'SUCCEEDED',result:{processedCandles:comparison.challenger.processedCandles,closedTrades:comparison.challenger.closedTrades,evaluationVersion:'P4_SAME_WINDOW_RESEARCH_V1',comparison,feedback}});
  return {status:'AWAITING_INDEPENDENT_VALIDATION',candidate,comparison,feedback,ledger:trainingLedgerSnapshot(ledger)};
 }catch(error){
  completeTrainingRun(ledger,{runId,status:'FAILED',result:{reason:error instanceof Error?error.message:String(error)}});
  throw error;
 }
}
