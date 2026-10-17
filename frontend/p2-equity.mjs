// Time-series account statistics. Values must be real simulation equity snapshots.
export function equityMetrics(snapshots,initialCapital){
 if(!Array.isArray(snapshots)||!Number.isFinite(initialCapital)||initialCapital<=0)throw Error("invalid equity input");
 let peak=initialCapital,maxDrawdown=0,previous=-1;
 for(const point of snapshots){
  if(!Number.isSafeInteger(point.closeTime)||point.closeTime<=previous||!Number.isFinite(point.equity)||point.equity<0)throw Error("invalid equity snapshot");
  previous=point.closeTime;
  peak=Math.max(peak,point.equity);
  maxDrawdown=Math.max(maxDrawdown,(peak-point.equity)/peak);
 }
 const endingEquity=snapshots.length?snapshots.at(-1).equity:initialCapital;
 const totalReturn=endingEquity/initialCapital-1;
 const start=snapshots[0]?.closeTime,end=snapshots.at(-1)?.closeTime;
 const elapsedYears=snapshots.length>1?(end-start)/(365.25*86400000):0;
 const annualizedReturn=elapsedYears>0&&endingEquity>0?Math.pow(endingEquity/initialCapital,1/elapsedYears)-1:null;
 return {endingEquity,totalReturn,maxDrawdown,annualizedReturn,elapsedYears,snapshotCount:snapshots.length};
}
