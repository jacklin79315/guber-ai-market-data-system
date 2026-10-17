// P4 immutable job specification fingerprint. Prevents applying stale checkpoints
// to different symbols, windows, research settings or code revisions.
import {createHash} from 'node:crypto';
const canonical=value=>{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object'){
  if(Object.getPrototypeOf(value)!==Object.prototype)throw Error('P4 spec requires plain JSON objects');
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 }
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 throw Error('P4 spec contains non-JSON value');
};
export function fingerprintP4JobSpec(spec){
 if(!spec||typeof spec!=='object'||Array.isArray(spec))throw Error('invalid P4 job spec');
 for(const field of ['symbol','timeframe','fromOpenTime','toOpenTime','codeRevision','championVersion','iterations','seed'])if(spec[field]===undefined)throw Error('P4 job spec missing '+field);
 return createHash('sha256').update(JSON.stringify(canonical(spec))).digest('hex');
}
export function assertP4CheckpointCompatible(checkpoint,{jobId,specFingerprint}={}){
 if(!checkpoint||checkpoint.jobId!==jobId||checkpoint.specFingerprint!==specFingerprint)throw Error('P4 checkpoint does not match immutable job specification');
 return true;
}
