import {createAccount,submitProposal,processBar} from './p2-simulator.mjs';
import {detectEntryCandidate} from './p3-entry-baseline.mjs';
import {runFiveExpertResearch} from './p3-five-expert-research.mjs';
import {approvedToSimulationProposal} from './p3-p2-bridge.mjs';
import {tradeMetrics} from './p2-metrics.mjs';
// Sequential research replay: close bar -> update P2 account -> decide using only known data.
// History and feature resolvers must provide strictly causal observations; never place live orders.
export async function runSequentialFiveExpertReplay({candles,featureAtDecision,historyAtDecision,brain,costs,accountOptions={},lookback=20,threshold=0.001,minProbabilitySamples=30,minTimeSamples=10,maxDecisions=100000}={}){
 if(!Array.isArray(candles)||typeof featureAtDecision!=='function'||typeof historyAtDecision!=='function'||typeof brain!=='function'||!costs||!Number.isFinite(costs.feeRate)||costs.feeRate<0||!Number.isFinite(costs.slippageRate)||costs.slippageRate<0||costs.slippageRate>=1||!Number.isSafeInteger(maxDecisions)||maxDecisions<1)throw Error('invalid sequential replay inputs');
 const account=createAccount(accountOptions),seen=new Set(),prefix=[],decisions=[],events=[];let lastTime=-1;
 for(let i=0;i<candles.length;i++){
  const bar=candles[i];if(!bar||!Number.isSafeInteger(bar.closeTime)||bar.closeTime<=lastTime||seen.has(bar.symbol+'|'+bar.timeframe+'|'+bar.closeTime))throw Error('nonchronological or duplicate candle');
  lastTime=bar.closeTime;seen.add(bar.symbol+'|'+bar.timeframe+'|'+bar.closeTime);
  events.push(...processBar(account,bar,i,costs).map(e=>({...e,closeTime:bar.closeTime})));
  prefix.push(bar);
  const entry=detectEntryCandidate({candles:prefix.slice(-(lookback+1)),lookback,threshold});
  if(entry.action==='WAIT')continue;
  if(decisions.length>=maxDecisions)throw Error('decision limit exceeded');
  const candidate={...entry,id:entry.symbol+'|'+entry.timeframe+'|'+entry.decisionTime+'|'+entry.side};
  const features=await featureAtDecision({candidate,decisionIndex:i,candles:structuredClone(prefix)});
  if(!features||!Number.isSafeInteger(features.asOfMs)||features.asOfMs>bar.closeTime)throw Error('future or undated feature snapshot');
  const history=await historyAtDecision({candidate,decisionIndex:i,closed:structuredClone(account.closed)});
  if(!history||!Array.isArray(history.tradeHistory)||!Array.isArray(history.holdingHistory))throw Error('invalid historical research samples');
  const committedCapital=[...account.pending,...account.positions].reduce((sum,p)=>sum+p.capital,0);
  const verdict=await runFiveExpertResearch({candidate,candles:prefix,features,tradeHistory:history.tradeHistory,holdingHistory:history.holdingHistory,account:{equity:account.equity,committedCapital},feeRate:costs.feeRate,slippageRate:costs.slippageRate,brain,minProbabilitySamples,minTimeSamples});
  decisions.push({id:candidate.id,decisionTime:bar.closeTime,action:verdict.action,reason:verdict.reason||null,history:verdict.history});
  if(verdict.action!=='APPROVE')continue;
  const proposal=approvedToSimulationProposal(verdict,{decisionIndex:i});
  const submission=submitProposal(account,proposal);
  events.push({type:submission.accepted?'SUBMITTED':'REJECTED',id:proposal.id,closeTime:bar.closeTime,reason:submission.reason||null});
 }
 return {account,metrics:tradeMetrics(account),decisions,events,processedCandles:candles.length,approvedCount:decisions.filter(d=>d.action==='APPROVE').length,waitCount:decisions.filter(d=>d.action==='WAIT').length};
}
