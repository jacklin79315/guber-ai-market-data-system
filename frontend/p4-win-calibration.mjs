// Outcome calibration research only: no single trade proves a probability forecast wrong.
// Requires settled, filled trades with numeric decision-time probabilities.
// Wilson 95% interval: descriptive binomial uncertainty, not an IID guarantee.
export function wilson95(successes,n){
 if(!Number.isSafeInteger(n)||n<1||!Number.isSafeInteger(successes)||successes<0||successes>n)throw Error('invalid Wilson sample');
 const z=1.959963984540054, z2=z*z,p=successes/n,den=1+z2/n;
 const center=(p+z2/(2*n))/den,margin=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/den;
 return {lower:Math.max(0,center-margin),upper:Math.min(1,center+margin)};
}
export function analyzeP4WinCalibration({decisions,closedTrades,minSamples=30,bins=5}={}){
 if(!Array.isArray(decisions)||!Array.isArray(closedTrades)||!Number.isSafeInteger(minSamples)||minSamples<2||!Number.isSafeInteger(bins)||bins<2||bins>20)throw Error('invalid calibration inputs');
 const byId=new Map();
 for(const d of decisions){if(!d||typeof d.id!=='string'||!d.id||byId.has(d.id))throw Error('invalid decision identity');byId.set(d.id,d)}
 const groups=Array.from({length:bins},(_,i)=>({lower:i/bins,upper:(i+1)/bins,count:0,forecastSum:0,winCount:0,brierSum:0}));
 const used=new Set();let excluded=0,qualified=0;
 for(const t of closedTrades){
  if(!t||typeof t.id!=='string'||!t.id||used.has(t.id))throw Error('duplicate or invalid closed trade');
  used.add(t.id);
  const d=byId.get(t.id),p=d?.proposalAtDecision?.winProbability;
  if(!d||d.action!=='APPROVE'||typeof p!=='number'||!Number.isFinite(p)||p<0||p>1||!['TP','SL'].includes(t.exitReason)){excluded++;continue}
  const win=t.exitReason==='TP'?1:0;
  const b=groups[Math.min(bins-1,Math.floor(p*bins))];
  b.count++;b.forecastSum+=p;b.winCount+=win;b.brierSum+=(p-win)**2;qualified++;
 }
 const summary=groups.map(b=>({lower:b.lower,upper:b.upper,count:b.count,meanForecast:b.count?b.forecastSum/b.count:null,observedWinRate:b.count?b.winCount/b.count:null,brierScore:b.count?b.brierSum/b.count:null,wilson95:b.count?wilson95(b.winCount,b.count):null,binSampleSufficient:b.count>=minSamples}));
 const totalBrier=groups.reduce((s,b)=>s+b.brierSum,0);
 return {schemaVersion:'P4_WIN_CALIBRATION_V1',status:qualified>=minSamples?'RESEARCH_CALIBRATION_READY':'INSUFFICIENT_CALIBRATION_SAMPLES',qualified,excluded,minSamples,brierScore:qualified?totalBrier/qualified:null,eligibleBinCount:summary.filter(b=>b.binSampleSufficient).length,bins:summary,diagnosticFaultAssigned:false,modelUpdated:false,warning:'TP/SL outcome frequency is a proxy for calibration, not proof of causal fault or independent validation. Wilson intervals assume independent Bernoulli observations and can understate uncertainty for correlated trades. Evaluate on untouched OOS data before training feedback.'};
}
