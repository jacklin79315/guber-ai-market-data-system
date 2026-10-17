import test from 'node:test';import assert from 'node:assert/strict';
import {compareChallengerReplay} from './p4-challenger-comparison.mjs';
import {DEFAULT_TRAINING_PARAMETERS as p} from './p4-challenger-parameters.mjs';
const base={candles:[{symbol:'BTCUSDT',timeframe:'1h',closeTime:1}],featureAtDecision:async()=>({}),brain:async()=>({action:'WAIT'}),costs:{feeRate:0.001,slippageRate:0.001},champion:{version:'a',parameters:p},challenger:{version:'b',parameters:p}};
for(const key of ['candles','featureAtDecision','historyAtDecision','brain','costs','accountOptions','trainingParameters','modelVersion','validationCandles']){
 test('rejects injected '+key+' in core comparison',async()=>{await assert.rejects(compareChallengerReplay({...base,otherReplayOptions:{[key]:undefined}}),/override/)});
}
