// Explicit bounded entry point for running diagnostic research on a verified candle window.
// No persistence, no live orders and no Champion promotion; call only from research context.
import {runP4DiagnosticOosExperiment} from './p4-diagnostic-oos-experiment.mjs';
export async function runP4ChronologicalDiagnosticResearch({candles,validationFraction=0.2,minTrainingCandles=100,minValidationCandles=30,...options}={}){
 if(!Array.isArray(candles)||!Number.isFinite(validationFraction)||validationFraction<=0||validationFraction>=0.5||!Number.isSafeInteger(minTrainingCandles)||minTrainingCandles<2||!Number.isSafeInteger(minValidationCandles)||minValidationCandles<2)throw Error('invalid P4 chronological research configuration');
 if(Object.hasOwn(options,'trainCandles')||Object.hasOwn(options,'validationCandles'))throw Error('P4 chronological research window override forbidden');
 const validationCount=Math.max(minValidationCandles,Math.floor(candles.length*validationFraction));
 const trainCount=candles.length-validationCount;
 if(trainCount<minTrainingCandles||validationCount>=candles.length)throw Error('insufficient P4 chronological candles');
 const result=await runP4DiagnosticOosExperiment({...options,trainCandles:candles.slice(0,trainCount),validationCandles:candles.slice(trainCount)});
 return {...result,partition:{trainCandles:trainCount,validationCandles:validationCount,validationFraction,method:'CHRONOLOGICAL_LAST_WINDOW'},independentValidation:false,championPromotionAllowed:false};
}
