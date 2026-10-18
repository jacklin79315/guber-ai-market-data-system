// Verify descriptive entry-regime group totals against paired replay feedback.
export function auditP4RegimeAttribution({regimeAttribution,feedback,tolerance=1e-6}={}){
 if(!regimeAttribution||!feedback||!Number.isFinite(tolerance)||tolerance<0)throw Error('invalid regime audit');
 const audit={};
 for(const side of ['champion','challenger']){
  const groups=regimeAttribution[side]?.groups;
  const summary=feedback[side];
  if(!Array.isArray(groups)||!summary||!Number.isFinite(summary.netRealizedPnl)||!Number.isFinite(summary.totalFees)||!Number.isSafeInteger(summary.closedTrades))throw Error('incomplete regime audit');
  const totals=groups.reduce((a,g)=>{
   if(!Number.isSafeInteger(g.closedTrades)||g.closedTrades<0||!Number.isFinite(g.netPnl)||!Number.isFinite(g.fees)||g.fees<0)throw Error('invalid regime group');
   a.closedTrades+=g.closedTrades;a.netPnl+=g.netPnl;a.fees+=g.fees;return a;
  },{closedTrades:0,netPnl:0,fees:0});
  if(totals.closedTrades!==summary.closedTrades||Math.abs(totals.netPnl-summary.netRealizedPnl)>tolerance||Math.abs(totals.fees-summary.totalFees)>tolerance||regimeAttribution[side].attributedTrades!==summary.closedTrades)throw Error('regime attribution does not reconcile to replay');
  audit[side]={...totals,reconciled:true};
 }
 return {schemaVersion:'P4_REGIME_ATTRIBUTION_AUDIT_V1',status:'RECONCILED',audit,independentValidation:false,championPromotionAllowed:false,ordersEnabled:false};
}
