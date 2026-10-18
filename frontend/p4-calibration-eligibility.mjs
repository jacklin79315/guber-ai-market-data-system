import {extractP4ClosedWinObservations} from './p4-win-evidence-adapter.mjs';
export function checkP4CalibrationEligibility(records, minimum=30){
 if(!Number.isSafeInteger(minimum)||minimum<2)throw Error('invalid minimum');
 const result=extractP4ClosedWinObservations({records});
 return {eligible:result.observations.length,excluded:result.excluded,total:result.totalRecords,ready:result.observations.length>=minimum,mode:'RESEARCH_ONLY',promotionAllowed:false};
}
