// Outcome calibration research only: no single trade proves a probability forecast wrong.
// Requires settled, filled trades with numeric decision-time probabilities.
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
 const summary=groups.map(b=>({lower:b.lower,upper:b.upper,count:b.count,meanForecast:b.count?b.forecastSum/b.count:null,observedWinRate:b.count?b.winCount/b.count:null,brierScore:b.count?b.brierSum/b.count:null}));
 const totalBrier=groups.reduce((s,b)=>s+b.brierSum,0);
 return {schemaVersion:'P4_WIN_CALIBRATION_V1',status:qualified>=minSamples?'RESEARCH_CALIBRATION_READY':'INSUFFICIENT_CALIBRATION_SAMPLES',qualified,excluded,minSamples,brierScore:qualified?totalBrier/qualified:null,bins:summary,diagnosticFaultAssigned:false,modelUpdated:false,warning:'TP/SL outcome frequency is a proxy for calibration, not proof of causal fault or independent validation. Evaluate on untouched OOS data before training feedback.'};
}
