// Chronological research/OOS partition. No overlapping candles, no training on OOS.
// The caller must keep validation candles untouched until the challenger is frozen.
export function partitionP4ChronologicalCandles({candles,validationFraction=0.2,minResearch=100,minValidation=30}={}){
 if(!Array.isArray(candles)||!Number.isFinite(validationFraction)||validationFraction<=0||validationFraction>=0.5||!Number.isSafeInteger(minResearch)||minResearch<2||!Number.isSafeInteger(minValidation)||minValidation<2)throw Error('invalid P4 partition settings');
 let last=-Infinity,market=null;
 for(const c of candles){
  if(!c||!Number.isSafeInteger(c.closeTime)||c.closeTime<=last||typeof c.symbol!=='string'||!c.symbol||typeof c.timeframe!=='string'||!c.timeframe)throw Error('invalid chronological candle sequence');
  const key=c.symbol+'|'+c.timeframe;if(market!==null&&key!==market)throw Error('mixed market in P4 partition');
  market=key;last=c.closeTime;
 }
 const validationCount=Math.max(minValidation,Math.ceil(candles.length*validationFraction)),split=candles.length-validationCount;
 if(split<minResearch||validationCount<minValidation)throw Error('insufficient P4 chronological partition samples');
 const research=candles.slice(0,split),validation=candles.slice(split);
 return {schemaVersion:'P4_CHRONOLOGICAL_PARTITION_V1',research,validation,boundary:{researchEndMs:research.at(-1).closeTime,validationStartMs:validation[0].closeTime},researchCount:research.length,validationCount:validation.length,validationUntouched:true,independentValidationCompleted:false,promotionAllowed:false};
}
