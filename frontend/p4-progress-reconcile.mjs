// P4 checkpoint/round reconciliation without mutating persisted history.
// One committed round may lead its checkpoint if the process crashed between writes.
export function reconcileP4ResearchProgress({checkpoint,rounds}={}){
 if(!checkpoint||!Number.isSafeInteger(checkpoint.completedIterations)||checkpoint.completedIterations<0||!Array.isArray(rounds))throw Error('invalid P4 recovery progress');
 if(rounds.length<checkpoint.completedIterations||rounds.length>checkpoint.completedIterations+1)throw Error('P4 recovery progress mismatch');
 for(let i=0;i<rounds.length;i++)if(!rounds[i]||rounds[i].iteration!==i+1)throw Error('P4 recovery round gap');
 if(checkpoint.phase==='COMPLETED'&&rounds.length!==checkpoint.completedIterations)throw Error('P4 completed checkpoint mismatch');
 return {resumeRounds:structuredClone(rounds),recoveredUncheckpointedRound:rounds.length>checkpoint.completedIterations,completedIterations:rounds.length};
}
