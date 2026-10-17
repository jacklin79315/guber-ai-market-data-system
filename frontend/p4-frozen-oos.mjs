import {createHash} from 'node:crypto';
import {validateTrainingParameters} from './p4-challenger-parameters.mjs';
import {compareChallengerReplay} from './p4-challenger-comparison.mjs';
// A sealed parameter snapshot and nonoverlapping chronological window are mandatory.
// This is an OOS comparison, NOT authorization for Champion promotion.
export async function evaluateP4FrozenOOS({researchBoundary,validationCandles,champion,challenger,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},otherReplayOptions={}}={}){
 if(!researchBoundary||!Number.isSafeInteger(researchBoundary.researchEndMs)||!Number.isSafeInteger(researchBoundary.validationStartMs)||researchBoundary.researchEndMs>=researchBoundary.validationStartMs||!Array.isArray(validationCandles)||!validationCandles.length)throw Error('invalid frozen OOS boundary');
 if(!champion||!challenger||typeof champion.version!=='string'||!champion.version||typeof challenger.version!=='string'||!challenger.version||champion.version===challenger.version)throw Error('invalid frozen OOS models');
 if(otherReplayOptions.candles||otherReplayOptions.trainingParameters||otherReplayOptions.modelVersion)throw Error('OOS replay override forbidden');
 let prev=researchBoundary.researchEndMs,market=null;
 for(const c of validationCandles){if(!c||!Number.isSafeInteger(c.closeTime)||c.closeTime<=prev||typeof c.symbol!=='string'||!c.symbol||typeof c.timeframe!=='string'||!c.timeframe)throw Error('OOS chronology overlaps research or is invalid');const key=c.symbol+'|'+c.timeframe;if(market!==null&&key!==market)throw Error('mixed OOS market');market=key;prev=c.closeTime}
 if(validationCandles[0].closeTime!==researchBoundary.validationStartMs)throw Error('OOS boundary does not match first validation candle');
 const frozen={champion:{version:champion.version,parameters:validateTrainingParameters(champion.parameters)},challenger:{version:challenger.version,parameters:validateTrainingParameters(challenger.parameters)}};
 const fingerprint=createHash('sha256').update(JSON.stringify({frozen,researchBoundary,market,first:validationCandles[0].closeTime,last:prev,count:validationCandles.length})).digest('hex');
 const comparison=await compareChallengerReplay({candles:validationCandles,featureAtDecision,historyAtDecision,brain,costs,accountOptions,champion:frozen.champion,challenger:frozen.challenger,otherReplayOptions});
 return {schemaVersion:'P4_FROZEN_OOS_EVALUATION_V1',status:'OOS_REPLAY_COMPLETED_REVIEW_REQUIRED',frozenFingerprint:fingerprint,boundary:structuredClone(researchBoundary),validationCandles:validationCandles.length,comparison,independentWindow:true,independentValidationPassed:false,promotionAllowed:false,warning:'OOS replay alone does not prove model independence, sufficient sample size, or safe promotion. No automatic retraining or Champion replacement.'};
}
