// P4 research-only feedback: rank reproducible same-window results for the NEXT experiment.
// This never certifies an out-of-sample result, promotes Champion or trades live.
export function assessP4ResearchFeedback({comparison,minClosedTrades=30,diagnosticAudit=comparison?.diagnosticAudit}={}){
 if(!comparison||comparison.status!=='RESEARCH_COMPARISON_ONLY'||comparison.independentValidation!==false||comparison.promotionAllowed!==false||!Number.isSafeInteger(minClosedTrades)||minClosedTrades<1)throw Error('invalid P4 research feedback');
 const a=comparison.champion,b=comparison.challenger;
 if(!a||!b||!a.metrics||!b.metrics||a.processedCandles!==b.processedCandles)throw Error('incomparable P4 research runs');
 const summarize=r=>{
  const m=r.metrics;
  if(!Number.isSafeInteger(m.closedTrades)||m.closedTrades<0||!Number.isFinite(m.netRealizedPnl)||!Number.isFinite(m.realizedReturn)||!Number.isFinite(m.totalFees)||m.totalFees<0||m.costLedgerComplete!==true)throw Error('incomplete P4 cost or trade evidence');
  return {version:r.version,closedTrades:m.closedTrades,netRealizedPnl:m.netRealizedPnl,realizedReturn:m.realizedReturn,totalFees:m.totalFees};
 };
 const champion=summarize(a),challenger=summarize(b);
 const sufficient=champion.closedTrades>=minClosedTrades&&challenger.closedTrades>=minClosedTrades;
 const risk=diagnosticAudit?.challenger?.actors?.Risk;
 const blockingRiskFault=Boolean(risk&&Number.isSafeInteger(risk.negative)&&risk.negative>0);
 const improved=sufficient&&!blockingRiskFault&&challenger.netRealizedPnl>champion.netRealizedPnl;
 return {status:sufficient?'RESEARCH_EVIDENCE_ONLY':'INSUFFICIENT_RESEARCH_SAMPLES',champion,challenger,minClosedTrades,improvedInSameWindow:improved,blockedByDiagnosticRisk: blockingRiskFault,proposedNextResearchParent:improved?challenger.version:champion.version,independentValidation:false,promotionAllowed:false,reason:blockingRiskFault?'Challenger has diagnosed Risk faults; research parent cannot advance on PnL alone':sufficient?'Same-window net PnL is research feedback only; separate untouched validation required':'Insufficient settled trades for research selection'};
}
