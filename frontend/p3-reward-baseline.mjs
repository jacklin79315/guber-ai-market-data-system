// Reward expert deterministic baseline. ATR from CLOSED candles; no inferred win probability.
export function estimateRewardBaseline({candidate,candles,atrPeriod=14,stopAtr=1.5,targetAtr=3,feeRate,slippageRate}={}){
 if(!candidate||!['LONG','SHORT'].includes(candidate.side)||!Array.isArray(candidate.entryRange)||candidate.entryRange.length!==2||!candidate.entryRange.every(v=>Number.isFinite(v)&&v>0)||candidate.entryRange[0]>candidate.entryRange[1]||!Array.isArray(candles)||!Number.isSafeInteger(atrPeriod)||atrPeriod<2||atrPeriod>100||![stopAtr,targetAtr].every(v=>Number.isFinite(v)&&v>0)||![feeRate,slippageRate].every(v=>Number.isFinite(v)&&v>=0&&v<0.1))throw Error('invalid reward baseline settings');
 if(candles.length<atrPeriod+1)return {action:'WAIT',reason:'INSUFFICIENT_ATR_HISTORY'};
 const bars=candles.slice(-(atrPeriod+1));let tr=0;
 for(let i=0;i<bars.length;i++){
  const b=bars[i];if(!b||!Number.isSafeInteger(b.closeTime)||b.closeTime>candidate.decisionTime||i&&b.closeTime<=bars[i-1].closeTime||b.symbol!==candidate.symbol||b.timeframe!==candidate.timeframe||![b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||b.low>b.high||b.close<b.low||b.close>b.high)throw Error('invalid reward candle');
  if(i>0)tr+=Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close));
 }
 const atr=tr/atrPeriod,entry=candidate.entryRange.reduce((a,b)=>a+b)/2;
 const stopDistance=atr*stopAtr,targetDistance=atr*targetAtr;
 const sideSign=candidate.side==='LONG'?1:-1;
 const stop=entry-sideSign*stopDistance,target=entry+sideSign*targetDistance;
 if(stop<=0||target<=0||candidate.side==='LONG'&&stop>=candidate.entryRange[0]||candidate.side==='SHORT'&&stop<=candidate.entryRange[1])return {action:'WAIT',reason:'INVALID_REWARD_LEVELS'};
 const roundTripCost=2*(feeRate+slippageRate);
 const expectedGain=targetDistance/entry-roundTripCost,expectedLoss=stopDistance/entry+roundTripCost;
 if(expectedGain<=0)return {action:'WAIT',reason:'COSTS_EXCEED_TARGET'};
 return {action:'CONTINUE',patch:{tpRange:[target,target],slRange:[stop,stop],riskReward:expectedGain/expectedLoss,expectedGain,expectedLoss,rewardReason:'ATR '+atrPeriod+' closed candles; stop '+stopAtr+' ATR, target '+targetAtr+' ATR, fee '+feeRate+', slippage '+slippageRate+' per side'},atr};
}
