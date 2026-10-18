import {extractP4ClosedWinObservations} from './p4-win-evidence-adapter.mjs';
import {inspectP4CalibrationWindows} from './p4-calibration-window-eligibility.mjs';
import {runP4WinCalibrationExperiment} from './p4-win-calibration-replay.mjs';
// Strictly research-only entrypoint for verified persisted diagnostic records.
export function evaluateP4PersistedWinCalibration({records,contract,bins=5}={}){
 if(!Array.isArray(records)||records.some(r=>r?.diagnosis?.schemaVersion!=='P4_DIAGNOSIS_V1'||r?.feedback?.schemaVersion!=='P4_FEEDBACK_V1'))throw Error('unverified calibration diagnostic evidence');
 const eligibility=inspectP4CalibrationWindows({records,contract});
 if(!eligibility.ready)return {schemaVersion:'P4_PERSISTED_WIN_CALIBRATION_V1',status:'BLOCKED_INSUFFICIENT_EVIDENCE',eligibility,experiment:null,mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 const extracted=extractP4ClosedWinObservations({records});
 if(extracted.observations.length!==eligibility.trainCount+eligibility.validationCount)throw Error('calibration evidence outside declared windows');
 const experiment=runP4WinCalibrationExperiment({contract,observations:extracted.observations,bins});
 return {schemaVersion:'P4_PERSISTED_WIN_CALIBRATION_V1',status:'RESEARCH_EXPERIMENT_COMPLETED',eligibility,experiment,mode:'RESEARCH_ONLY',ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
