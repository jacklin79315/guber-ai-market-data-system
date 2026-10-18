// P4 bounded causal experiment contract. Research-only; no model mutation or orders.
import {createHash} from 'node:crypto';
const TYPES=new Set(['WIN_PROBABILITY_CALIBRATION','WAIT_SHADOW_DECISION_QUALITY']);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const integer=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
export function defineP4CausalExperiment({jobId,kind,symbol='BTCUSDT',timeframe='1h',train,validation,hypothesis,minimumSamples=30}={}){
 if(typeof jobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(jobId)||!TYPES.has(kind)||symbol!=='BTCUSDT'||timeframe!=='1h'||typeof hypothesis!=='string'||hypothesis.trim().length<12||!integer(minimumSamples,30))throw Error('invalid P4 causal experiment');
 const windowOk=w=>w&&integer(w.from,1)&&integer(w.to,1)&&w.to>w.from&&integer(w.asOf,1)&&w.asOf>w.to;
 if(!windowOk(train)||!windowOk(validation)||train.to>=validation.from||train.asOf>validation.from||validation.asOf<=validation.to)throw Error('P4 experiment requires chronological disjoint windows and decision-time cutoffs');
 const definition={schemaVersion:'P4_CAUSAL_EXPERIMENT_V1',jobId,kind,symbol,timeframe,train:{...train},validation:{...validation},hypothesis:hypothesis.trim(),minimumSamples,mode:'RESEARCH_ONLY',liveTrading:false,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false};
 return Object.freeze({...definition,fingerprint:hash(definition)});
}
export function assessP4CausalExperiment({contract,trainSamples,validationSamples,baselineMetric,candidateMetric}={}){
 if(!contract||contract.schemaVersion!=='P4_CAUSAL_EXPERIMENT_V1'||contract.fingerprint!==hash(Object.fromEntries(Object.entries(contract).filter(([k])=>k!=='fingerprint'))))throw Error('invalid or modified causal contract');
 if(!integer(trainSamples)||!integer(validationSamples))throw Error('invalid causal sample counts');
 const measured=Number.isFinite(baselineMetric)&&Number.isFinite(candidateMetric);
 const eligible=trainSamples>=contract.minimumSamples&&validationSamples>=contract.minimumSamples&&measured;
 return {schemaVersion:'P4_CAUSAL_EXPERIMENT_ASSESSMENT_V1',jobId:contract.jobId,contractFingerprint:contract.fingerprint,status:eligible?'EVIDENCE_READY_FOR_INDEPENDENT_REVIEW':'INSUFFICIENT_CAUSAL_EVIDENCE',trainSamples,validationSamples,baselineMetric:measured?baselineMetric:null,candidateMetric:measured?candidateMetric:null,improvement:eligible?candidateMetric-baselineMetric:null,mode:'RESEARCH_ONLY',modelUpdateApplied:false,championPromotionAllowed:false,ordersEnabled:false};
}
