import test from "node:test";
import assert from "node:assert/strict";
import {tradeMetrics} from "./p2-metrics.mjs";
const account=()=>({initialCapital:10000,closed:[],pending:[],positions:[],shadowOrders:[]});
test("empty account reports no fabricated win rate",()=>{const m=tradeMetrics(account());assert.equal(m.closedTrades,0);assert.equal(m.winRate,null);assert.equal(m.profitFactor,null)});
test("winning and losing trades compute realized statistics",()=>{const a=account();a.closed=[{pnl:200},{pnl:-100},{pnl:0}];const m=tradeMetrics(a);assert.equal(m.netRealizedPnl,100);assert.equal(m.realizedReturn,0.01);assert.equal(m.winRate,1/3);assert.equal(m.profitFactor,2);assert.equal(m.breakeven,1)});
test("shadow and open trades never enter realized PnL",()=>{const a=account();a.closed=[{pnl:50}];a.positions=[{pnl:999}];a.shadowOrders=[{realizedPnl:-1000}];const m=tradeMetrics(a);assert.equal(m.netRealizedPnl,50);assert.equal(m.openPositions,1);assert.equal(m.shadowOrders,1)});
test("reject invalid realized PnL",()=>{const a=account();a.closed=[{pnl:NaN}];assert.throws(()=>tradeMetrics(a),/non-finite/)});

test("shadow statuses are counted without changing realized PnL",()=>{const a=account();a.shadowOrders=[{counterfactualStatus:"ENTRY_REVISITED"},{counterfactualStatus:"AMBIGUOUS_SEQUENCE"},{}];const m=tradeMetrics(a);assert.equal(m.shadowStatusCounts.ENTRY_REVISITED,1);assert.equal(m.shadowStatusCounts.AMBIGUOUS_SEQUENCE,1);assert.equal(m.shadowStatusCounts.NOT_OBSERVED,1);assert.equal(m.netRealizedPnl,0)});

test('complete cost ledger reconciles gross profit, fees and net PnL',()=>{const a=account();a.closed=[{pnl:7,grossPnl:10,entryFee:1,exitFee:2},{pnl:-6,grossPnl:-4,entryFee:1,exitFee:1}];const m=tradeMetrics(a);assert.equal(m.costLedgerCoverage,2);assert.equal(m.grossRealizedPnl,6);assert.equal(m.entryFees,2);assert.equal(m.exitFees,3);assert.equal(m.totalFees,5);assert.equal(m.netRealizedPnl,1);assert.equal(m.grossRealizedPnl-m.totalFees,m.netRealizedPnl)});
test('cost ledger rejects mismatched fee and net PnL',()=>{const a=account();a.closed=[{pnl:8,grossPnl:10,entryFee:1,exitFee:2}];assert.throws(()=>tradeMetrics(a),/cost reconciliation/)});
test('legacy trades without fee details remain explicitly uncovered',()=>{const a=account();a.closed=[{pnl:5}];const m=tradeMetrics(a);assert.equal(m.costLedgerCoverage,0);assert.equal(m.netRealizedPnl,5)});
