// Conservative OOS evidence gate. A passing sample gate only permits human
// review, never autonomous promotion or claims of statistical independence.
export function assessP4OOSReadiness({comparison,minClosedTrades=30,minProcessedCandles=100}={}){
 if(!comparison||!comparison.champion||!comparison.challenger||!Number.isSafeInteger(minClosedTrades)||minClosedTrades<1||!Number.isSafeInteger(minProcessedCandles)||minProcessedCandles<2)throw Error('invalid OOS readiness inputs');
 const reasons=[];
 for(const side of ['champion','challenger']){
  const r=comparison[side],m=r.metrics;
  if(!Number.isSafeInteger(r.processedCandles)||r.processedCandles<minProcessedCandles)reasons.push(side+':INSUFFICIENT_CANDLES');
  if(!m||!Number.isSafeInteger(m.closedTrades)||m.closedTrades<minClosedTrades)reasons.push(side+':INSUFFICIENT_CLOSED_TRADES');
  if(!m||m.costLedgerComplete!==true||!Number.isFinite(m.netRealizedPnl)||!Number.isFinite(m.totalFees))reasons.push(side+':INCOMPLETE_COST_LEDGER');
 }
 if(comparison.champion.processedCandles!==comparison.challenger.processedCandles)reasons.push('UNEQUAL_REPLAY_LENGTH');
 const audit=comparison.diagnosticAudit;
 if(!audit?.champion||!audit?.challenger)reasons.push('MISSING_DIAGNOSTIC_AUDIT');
 if(comparison.controls?.sameCandles!==true||comparison.controls?.sameCosts!==true||comparison.controls?.sameInitialCapital!==true)reasons.push('UNCONTROLLED_COMPARISON');
 return {schemaVersion:'P4_OOS_READINESS_V1',status:reasons.length?'INSUFFICIENT_OOS_EVIDENCE':'ELIGIBLE_FOR_MANUAL_REVIEW',reasons,minClosedTrades,minProcessedCandles,independentValidationPassed:false,promotionAllowed:false,warning:'Evidence gate is necessary but not sufficient: review leakage, causal diagnoses, uncertainty, regime diversity and risk before any promotion.'};
}
