import {extractP4ClosedWinObservations} from './p4-win-evidence-adapter.mjs';
import {createHash} from 'node:crypto';
// Verify the actual experiment windows before any calibration replay.
export function inspectP4CalibrationWindows({records,contract}={}){
 if(contract?.schemaVersion!=='P4_CAUSAL_EXPERIMENT_V1'||contract.kind!=='WIN_PROBABILITY_CALIBRATION'||typeof contract.fingerprint!=='string')throw Error('invalid calibration contract');
 const {fingerprint,...definition}=contract;
 const expected=createHash('sha256').update(JSON.stringify(definition)).digest('hex');
 if(expected!==fingerprint)throw Error('modified calibration contract');
 const {observations,excluded}=extractP4ClosedWinObservations({records});
 const train=contract.train,validation=contract.validation,min=contract.minimumSamples;
 if(!train||!validation||!Number.isSafeInteger(min)||min<30||train.to>=validation.from||train.asOf>validation.from)throw Error('invalid chronological windows');
 let trainCount=0,validationCount=0,lateTrain=0,lateValidation=0;
 for(const r of observations){
  if(r.decidedAt>=train.from&&r.decidedAt<train.to){if(r.closedAt<=train.asOf)trainCount++;else lateTrain++;}
  if(r.decidedAt>=validation.from&&r.decidedAt<validation.to){if(r.closedAt<=validation.asOf)validationCount++;else lateValidation++;}
 }
 const ready=trainCount>=min&&validationCount>=min&&lateTrain===0&&lateValidation===0;
 return {schemaVersion:'P4_CALIBRATION_WINDOW_ELIGIBILITY_V1',status:ready?'READY_FOR_RESEARCH_REPLAY':'INSUFFICIENT_CHRONOLOGICAL_EVIDENCE',ready,trainCount,validationCount,lateTrain,lateValidation,minimumPerWindow:min,excluded,mode:'RESEARCH_ONLY',modelUpdateApplied:false,championPromotionAllowed:false};
}
