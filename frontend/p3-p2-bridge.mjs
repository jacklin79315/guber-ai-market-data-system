// Explicit bridge from approved P3 advice to the P2 research simulator.
// No live orders, no synthetic expert signals, no implicit APPROVE.
export function approvedToSimulationProposal(result,{decisionIndex}={}){
 if(!result||result.action!=='APPROVE')throw Error('only Brain APPROVE can enter P2');
 const p=result.proposal;
 if(!p||!Number.isSafeInteger(decisionIndex)||decisionIndex<0||typeof p.id!=='string'||!p.id||!['LONG','SHORT'].includes(p.side)||!['15m','1h','4h','1d'].includes(p.timeframe)||typeof p.symbol!=='string')throw Error('invalid approved proposal');
 const range=x=>Array.isArray(x)&&x.length===2&&x.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0)&&x[0]<=x[1];
 if(!range(p.entryRange)||!range(p.tpRange)||!range(p.slRange)||!Number.isFinite(p.allocation)||p.allocation<=0)throw Error('invalid approved trade levels');
 if(p.side==='LONG'&&!(p.slRange[1]<p.entryRange[0]&&p.tpRange[0]>p.entryRange[1])||p.side==='SHORT'&&!(p.tpRange[1]<p.entryRange[0]&&p.slRange[0]>p.entryRange[1]))throw Error('invalid approved direction');
 return {id:p.id,symbol:p.symbol,timeframe:p.timeframe,side:p.side,decisionIndex,entry:[...p.entryRange],takeProfit:[...p.tpRange],stopLoss:[...p.slRange],capital:p.allocation};
}
