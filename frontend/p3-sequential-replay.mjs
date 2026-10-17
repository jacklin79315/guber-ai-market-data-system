import {buildCausalExpertHistory,attachClosedTimes} from './p3-causal-history.mjs';
import {createAccount,submitProposal,processBar} from './p2-simulator.mjs';
import {detectEntryCandidate} from './p3-entry-baseline.mjs';
import {runFiveExpertResearch} from './p3-five-expert-research.mjs';
import {approvedToSimulationProposal} from './p3-p2-bridge.mjs';
import {tradeMetrics} from './p2-metrics.mjs';
// Sequential research replay: close bar -> update P2 account -> decide using only known data.
// History and feature resolvers must provide strictly causal observations; never place live orders.
export async function runSequentialFiveExpertReplay({candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},lookback=20,threshold=0.001,minProbabilitySamples=30,minTimeSamples=10,maxDecisions=100000}={}){
 if(!Array.isArray(candles)||typeof featureAtDecision!=='function'||(historyAtDecision!==undefined&&typeof historyAtDecision!=='function')||typeof brain!=='function'||!costs||!Number.isFinite(costs.feeRate)||costs.feeRate<0||!Number.isFinite(costs.slippageRate)||costs.slippageRate<0||costs.slippageRate>=1||!Number.isSafeInteger(maxDecisions)||maxDecisions<1)throw Error('invalid sequential replay inputs');
 const account=createAccount(accountOptions),seen=new Set(),prefix=[],decisions=[],events=[],decisionArchive=new Map();let lastTime=-1,seriesSymbol=null,seriesTimeframe=null;
 for(let i=0;i<candles.length;i++){
  const bar=candles[i];if(!bar||!Number.isSafeInteger(bar.closeTime)||bar.closeTime<=lastTime||seen.has(bar.symbol+'|'+bar.timeframe+'|'+bar.closeTime))throw Error('nonchronological or duplicate candle');
  if(seriesSymbol===null){seriesSymbol=bar.symbol;seriesTimeframe=bar.timeframe;}
  if(bar.symbol!==seriesSymbol||bar.timeframe!==seriesTimeframe)throw Error('sequential replay requires one symbol and one timeframe');
  lastTime=bar.closeTime;seen.add(bar.symbol+'|'+bar.timeframe+'|'+bar.closeTime);
  events.push(...processBar(account,bar,i,costs).map(e=>({...e,closeTime:bar.closeTime})));
  prefix.push(bar);
  const entry=detectEntryCandidate({candles:prefix.slice(-(lookback+1)),lookback,threshold});
  if(entry.action==='WAIT')continue;
  if(decisions.length>=maxDecisions)throw Error('decision limit exceeded');
  const candidate={...entry,id:entry.symbol+'|'+entry.timeframe+'|'+entry.decisionTime+'|'+entry.side};
  const features=await featureAtDecision({candidate,decisionIndex:i,candles:structuredClone(prefix)});
  if(!features||!Number.isSafeInteger(features.asOfMs)||features.asOfMs>bar.closeTime)throw Error('future or undated feature snapshot');
  const history=historyAtDecision?await historyAtDecision({candidate,decisionIndex:i,closed:structuredClone(account.closed)}):buildCausalExpertHistory({closed:attachClosedTimes({closed:account.closed,candles:prefix}),decisionArchive,asOfMs:bar.closeTime});
  if(!history||!Array.isArray(history.tradeHistory)||!Array.isArray(history.holdingHistory))throw Error('invalid historical research samples');
  const committedCapital=[...account.pending,...account.positions].reduce((sum,p)=>sum+p.capital,0);
  const verdict=await runFiveExpertResearch({candidate,candles:prefix,features,tradeHistory:history.tradeHistory,holdingHistory:history.holdingHistory,account:{equity:account.equity,committedCapital},feeRate:costs.feeRate,slippageRate:costs.slippageRate,brain,minProbabilitySamples,minTimeSamples});
  decisions.push({id:candidate.id,decisionTime:bar.closeTime,action:verdict.action,reason:verdict.reason||null,history:verdict.history});
  if(verdict.action!=='APPROVE')continue;
  const proposal=approvedToSimulationProposal(verdict,{decisionIndex:i});
  const submission=submitProposal(account,proposal);
  if(submission.accepted)decisionArchive.set(proposal.id,{decisionTime:bar.closeTime,features:structuredClone(features)});
  events.push({type:submission.accepted?'SUBMITTED':'REJECTED',id:proposal.id,closeTime:bar.closeTime,reason:submission.reason||null});
 }
 const count=type=>events.filter(e=>e.type===type).length;
 const statistics={candidateCount:decisions.length,approvedCount:decisions.filter(d=>d.action==='APPROVE').length,waitCount:decisions.filter(d=>d.action==='WAIT').length,rejectedByBrainCount:decisions.filter(d=>d.action==='REJECT').length,submittedCount:count('SUBMITTED'),rejectedSubmissionCount:count('REJECTED'),filledCount:count('OPEN'),closedCount:count('CLOSED'),cancelledBeforeFillCount:count('CANCELLED'),capitalWaitEvents:count('WAIT_CAPITAL'),openPositionCount:account.positions.length,pendingOrderCount:account.pending.length,realizedTradeCount:account.closed.length};
 return {account,metrics:tradeMetrics(account),decisions,events,processedCandles:candles.length,approvedCount:statistics.approvedCount,waitCount:statistics.waitCount,statistics};
}
