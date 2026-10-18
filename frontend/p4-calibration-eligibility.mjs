import {extractP4ClosedWinObservations} from './p4-win-evidence-adapter.mjs';
// Eligibility is only a preflight check; actual train/OOS splits must be verified separately.
export function checkP4CalibrationEligibility(records, minimum=30){
 if(!Number.isSafeInteger(minimum)||minimum<2)throw Error('invalid minimum');
 const result=extractP4ClosedWinObservations({records});
 const requiredForTwoWindows=minimum*2;
 return {eligible:result.observations.length,excluded:result.excluded,total:result.totalRecords,minimumPerWindow:minimum,minimumForTwoWindows:requiredForTwoWindows,ready:result.observations.length>=requiredForTwoWindows,status:result.observations.length>=requiredForTwoWindows?'READY_FOR_CHRONOLOGICAL_SPLIT_CHECK':'INSUFFICIENT_VERIFIED_EVIDENCE',mode:'RESEARCH_ONLY',promotionAllowed:false};
}
