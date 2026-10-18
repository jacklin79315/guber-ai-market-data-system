// Deterministic past-only calibration benchmark. Evidence, not proof of causality.
import {createHash} from 'node:crypto';
import {assessP4CausalExperiment} from './p4-causal-experiment.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const valid=x=>Number.isFinite(x)&&x>=0&&x<=1;
export function runP4WinCalibrationExperiment({contract,observations,bins=5}={}){
 if(contract?.kind!=='WIN_PROBABILITY_CALIBRATION'||!Array.isArray(observations)||!Number.isSafeInteger(bins)||bins<2||bins>20)throw Error('invalid calibration experiment');
 const sorted=[...observations].sort((a,b)=>a.decidedAt-b.decidedAt);
 let last=-Infinity;
 for(const r of sorted){
  if(!r||!Number.isSafeInteger(r.decidedAt)||!Number.isSafeInteger(r.closedAt)||r.closedAt<=r.decidedAt||r.decidedAt<=last||!valid(r.probability)||![0,1].includes(r.outcome))throw Error('invalid, duplicate or uncalibrated closed-trade observation');
  last=r.decidedAt;
 }
 // Closed labels must have been available before training cutoff. Validation labels
 // are measured after the decisions; they must never influence fitted bins.
 const train=sorted.filter(r=>r.decidedAt>=contract.train.from&&r.decidedAt<contract.train.to&&r.closedAt<=contract.train.asOf);
 const validation=sorted.filter(r=>r.decidedAt>=contract.validation.from&&r.decidedAt<contract.validation.to&&r.closedAt<=contract.validation.asOf);
 if(sorted.some(r=>r.decidedAt>=contract.train.from&&r.decidedAt<contract.train.to&&r.closedAt>contract.train.asOf))throw Error('training labels extend past asOf cutoff');
 if(sorted.some(r=>r.decidedAt>=contract.validation.from&&r.decidedAt<contract.validation.to&&r.closedAt>contract.validation.asOf))throw Error('validation outcome is not closed by evaluation cutoff');
 const groups=Array.from({length:bins},()=>({wins:0,count:0}));
 const bin=p=>Math.min(bins-1,Math.floor(p*bins));
 for(const r of train){const g=groups[bin(r.probability)];g.wins+=r.outcome;g.count++;}
 // Laplace shrinkage, training only; sparse bins fall back to global prior.
 const global=(train.reduce((s,r)=>s+r.outcome,0)+1)/(train.length+2);
 const calibrated=p=>{const g=groups[bin(p)];return g.count>=5?(g.wins+2*global)/(g.count+2):global;};
 const brier=(rows,fn)=>rows.length?rows.reduce((s,r)=>s+(fn(r.probability)-r.outcome)**2,0)/rows.length:null;
 const baseline=brier(validation,p=>p),candidate=brier(validation,calibrated);
 const assessment=assessP4CausalExperiment({contract,trainSamples:train.length,validationSamples:validation.length,baselineMetric:baseline,candidateMetric:candidate});
 return {...assessment,schemaVersion:'P4_WIN_CALIBRATION_REPLAY_V1',metric:'BRIER_SCORE_LOWER_IS_BETTER',baselineBrier:baseline,candidateBrier:candidate,improvement:baseline===null?null:baseline-candidate,trainFingerprint:sha(train),validationFingerprint:sha(validation),bins:groups.map(g=>({count:g.count,wins:g.wins})),trainingPrior:global,independentValidationPassed:false,causalEffectProven:false,modelUpdateApplied:false,championPromotionAllowed:false};
}
