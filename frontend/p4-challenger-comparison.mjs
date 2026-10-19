import {analyzeP4WinCalibration} from './p4-win-calibration.mjs';
import {collectP4DiagnosticEvidence} from './p4-diagnostic-evidence.mjs';
import {summarizeP4DiagnosticFeedback} from './p4-diagnostic-audit.mjs';
import {planP4DiagnosticUpdate} from './p4-diagnostic-update-plan.mjs';
import {runSequentialFiveExpertReplay} from './p3-sequential-replay.mjs';
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
// Run two isolated paper simulations on exactly the same closed candles and decision providers.
// These are research results, NOT independent validation unless a separate untouched window is supplied.
export async function compareChallengerReplay({candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},champion,challenger,otherReplayOptions={}}={}){
 if(!Array.isArray(candles)||candles.length===0||typeof featureAtDecision!=='function'||typeof brain!=='function'||!costs||!champion||!challenger||typeof champion.version!=='string'||!champion.version||typeof challenger.version!=='string'||!challenger.version||champion.version===challenger.version)throw Error('invalid challenger comparison');
 if(!otherReplayOptions||typeof otherReplayOptions!=='object'||Array.isArray(otherReplayOptions)||['candles','validationCandles','featureAtDecision','historyAtDecision','brain','costs','accountOptions','trainingParameters','modelVersion'].some(k=>Object.hasOwn(otherReplayOptions,k)))throw Error('comparison replay override forbidden');
 const championParams=validateTrainingParameters(champion.parameters),challengerParams=validateTrainingParameters(challenger.parameters);
 const shared={...otherReplayOptions,candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions};
 // Model identity and parameters are sealed independently for each replay.
 const [championResult,challengerResult]=await Promise.all([
  runSequentialFiveExpertReplay({...shared,trainingParameters:championParams,modelVersion:champion.version}),
  runSequentialFiveExpertReplay({...shared,trainingParameters:challengerParams,modelVersion:challenger.version})
 ]);
 const summarize=(version,r)=>({version,processedCandles:r.processedCandles,statistics:r.statistics,metrics:r.metrics,initialCapital:r.account.initialCapital,closedTrades:r.account.closed.length});
 const diagnosticEvidence={champion:collectP4DiagnosticEvidence({...championResult,candles}),challenger:collectP4DiagnosticEvidence({...challengerResult,candles})};
 const diagnosticAudit={champion:summarizeP4DiagnosticFeedback(diagnosticEvidence.champion),challenger:summarizeP4DiagnosticFeedback(diagnosticEvidence.challenger)};
 const winCalibration={champion:analyzeP4WinCalibration({decisions:championResult.decisions,closedTrades:championResult.account.closed}),challenger:analyzeP4WinCalibration({decisions:challengerResult.decisions,closedTrades:challengerResult.account.closed})};
 const diagnosticUpdatePlan=planP4DiagnosticUpdate({audit:diagnosticAudit.challenger,parentParameters:challengerParams});
 // Controlled one-parameter intervention: attribute the observed same-window
 // performance difference to a changed parameter, NOT to a trade-level expert fault.
 const changedParameters=Object.keys(championParams).filter(key=>championParams[key]!==challengerParams[key]);
 const parameterContribution=changedParameters.length===1?(()=>{const parameter=changedParameters[0],actor=parameter.startsWith('entry')?'Entry':'Reward';const baseline=championResult.metrics,trial=challengerResult.metrics;return {schemaVersion:'P4_PARAMETER_INTERVENTION_V1',actor,parameter,from:championParams[parameter],to:challengerParams[parameter],sameWindow:true,causalExpertFaultEstablished:false,closedTrades:{baseline:baseline.closedTrades,trial:trial.closedTrades},sufficient:baseline.closedTrades>=30&&trial.closedTrades>=30,deltaNetRealizedPnl:trial.netRealizedPnl-baseline.netRealizedPnl,deltaWinRate:trial.winRate-baseline.winRate,interpretation:'Controlled parameter intervention on identical historical candles; not independent OOS or proof of individual expert error.'};})():null;
 return {diagnosticEvidence,diagnosticAudit,diagnosticUpdatePlan,parameterContribution,winCalibration,status:'RESEARCH_COMPARISON_ONLY',independentValidation:false,promotionAllowed:false,champion:summarize(champion.version,championResult),challenger:summarize(challenger.version,challengerResult),controls:{sameCandles:true,sameCosts:true,sameInitialCapital:true,sameBrainProvider:true,sameFeatureProvider:true},warning:'Same-window comparisons are not independent out-of-sample evidence. No promotion is authorized.'};
}
