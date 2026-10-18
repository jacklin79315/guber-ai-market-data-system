import test from 'node:test';
import assert from 'node:assert/strict';
import {attributeP4ClosedTradesByRegime} from './p4-regime-trade-attribution.mjs';
test('attributes trades once using entry-time features',async()=>{
 const r=await attributeP4ClosedTradesByRegime({
  closedTrades:[{id:'BTCUSDT|1h|3600000|LONG',pnl:5,totalFees:1}],
  decisions:[{id:'BTCUSDT|1h|3600000|LONG',decisionTime:3600000}],
  featureAtDecision:async()=>({asOfMs:3600000,trendStrength:30,atrPercent:0.01})
 });
 assert.equal(r.groups[0].regime,'TREND_NORMAL_VOL');
 assert.equal(r.groups[0].netPnl,5);
 assert.equal(r.championPromotionAllowed,false);
});
