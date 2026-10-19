import {attachClosedTimes} from './p3-causal-history.mjs';
import {diagnoseP4Decision,scoreP4DiagnosticFeedback} from './p4-independent-diagnosis.mjs';
import {assessP4ExpertHistory,assessP4RiskEvidence,assessP4ProposalInvariants,mergeP4ActorAssessments} from './p4-rule-diagnostician.mjs';
// Evidence adapter: preserve observed facts; do not infer fault from realized profit or loss.
// Actual expert quality assessment must be supplied by a separately validated diagnostician.
export function collectP4DiagnosticEvidence(replay){
 if(!replay||!Array.isArray(replay.decisions)||!Array.isArray(replay.account?.closed)||!Array.isArray(replay.account?.shadowOrders))throw Error('invalid P4 replay evidence');
 if(replay.decisions.some(d=>!d||typeof d.id!=='string'||!d.id)||new Set(replay.decisions.map(d=>d.id)).size!==replay.decisions.length)throw Error('duplicate or invalid replay decision id');
 const decisions=new Map(replay.decisions.map(d=>[d.id,d]));
 const closed=Array.isArray(replay.candles)?attachClosedTimes({closed:replay.account.closed,candles:replay.candles}):replay.account.closed;
 // A supplied candle series must resolve all exits; never silently fall back to unverified timestamps.
 const events=[];
 for(const trade of closed){
  const decision=decisions.get(trade.id);
  if(!decision)throw Error('closed trade lacks original decision: '+trade.id);
  if(trade.closedTime!=null&&(!Number.isSafeInteger(trade.closedTime)||trade.closedTime<=decision.decisionTime))throw Error('invalid causal closed timestamp');
  events.push({decisionId:trade.id,outcome:'CLOSED',evidence:{decisionTime:decision.decisionTime,closedAt:trade.closedTime??null,realizedWin:Number.isFinite(trade.pnl)&&trade.pnl!==0?trade.pnl>0:null,action:decision.action,reason:decision.reason,expertHistory:decision.history,allocation:decision.allocation,proposalAtDecision:decision.proposalAtDecision,accountAtDecision:decision.accountAtDecision,riskDiagnostics:decision.riskDiagnostics,entryPrice:trade.entryPrice,exitPrice:trade.exitPrice,exitReason:trade.exitReason,netPnl:trade.pnl,fees:trade.totalFees},assessments:[]});
 }
 for(const shadow of replay.account.shadowOrders){
  const decision=decisions.get(shadow.proposal?.id);
  if(!decision)throw Error('shadow order lacks original decision');
  events.push({decisionId:shadow.proposal.id,outcome:'SHADOW',evidence:{decisionTime:decision.decisionTime,action:decision.action,expertHistory:decision.history,proposalAtDecision:decision.proposalAtDecision,accountAtDecision:decision.accountAtDecision,allocation:decision.allocation,riskDiagnostics:decision.riskDiagnostics,reason:decision.reason,cancelReason:shadow.reason,counterfactualStatus:shadow.counterfactualStatus??'NOT_OBSERVED',observations:shadow.observations},assessments:[]});
 }
 for(const decision of replay.decisions.filter(d=>d.action==='WAIT'||d.action==='RETURN'||d.action==='REJECT')){
  events.push({decisionId:decision.id,outcome:decision.action==='RETURN'?'RETURN':'WAIT',evidence:{decisionTime:decision.decisionTime,action:decision.action,reason:decision.reason,expertHistory:decision.history,accountAtDecision:decision.accountAtDecision,allocation:decision.allocation,proposalAtDecision:decision.proposalAtDecision,riskDiagnostics:decision.riskDiagnostics},assessments:[]});
 }
 return events.map(e=>{const diagnosis=diagnoseP4Decision({...e,assessments:mergeP4ActorAssessments([...assessP4RiskEvidence(e),...assessP4ProposalInvariants(e),...assessP4ExpertHistory(e)])});return {diagnosis,feedback:scoreP4DiagnosticFeedback(diagnosis),evidence:e.evidence}});
}
