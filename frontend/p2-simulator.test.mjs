import test from "node:test";
import assert from "node:assert/strict";
import {createAccount,submitProposal,processBar} from "./p2-simulator.mjs";
const p=(overrides={})=>({id:"p1",symbol:"BTCUSDT",timeframe:"1h",side:"LONG",decisionIndex:0,entry:[99,101],takeProfit:[110,111],stopLoss:[90,91],capital:2000,...overrides});
const bar=(low,high,close=100)=>({symbol:"BTCUSDT",timeframe:"1h",open:Math.max(low,Math.min(high,100)),low,high,close});
const costs={feeRate:0,slippageRate:0};
test("decision candle cannot fill",()=>{const a=createAccount();submitProposal(a,p());assert.deepEqual(processBar(a,bar(99,101),0,costs),[]);assert.equal(a.pending.length,1)});
test("next candle opens and capital stays within 80 percent",()=>{const a=createAccount();submitProposal(a,p());processBar(a,bar(99,101),1,costs);assert.equal(a.positions.length,1);assert.equal(a.cash,8000)});
test("pre-entry TP cancels without PnL",()=>{const a=createAccount();submitProposal(a,p());processBar(a,bar(105,111,108),1,costs);assert.equal(a.cancelled[0].cancelReason,"PRE_ENTRY_TP");assert.equal(a.cash,10000);assert.equal(a.closed.length,0)});
test("same candle entry and TP is conservatively cancelled as ambiguous",()=>{const a=createAccount();submitProposal(a,p());processBar(a,bar(99,111,108),1,costs);assert.equal(a.cancelled[0].cancelReason,"AMBIGUOUS_BAR");assert.equal(a.positions.length,0)});
test("TP and SL same candle resolve by closing distance, tie to SL",()=>{const a=createAccount();submitProposal(a,p());processBar(a,bar(99,101),1,costs);processBar(a,bar(90,111,100),2,costs);assert.equal(a.closed[0].exitReason,"SL")});
test("overlapping same symbol and timeframe is rejected",()=>{const a=createAccount();assert.equal(submitProposal(a,p()).accepted,true);assert.equal(submitProposal(a,p({id:"p2",entry:[100,102]})).reason,"OVERLAPPING_ENTRY")});
test("explicit fee and slippage required",()=>{const a=createAccount();assert.throws(()=>processBar(a,bar(99,101),1),/explicit costs required/)});
test("single account rejects aggregate allocation over 80 percent",()=>{const a=createAccount();submitProposal(a,p({capital:8000}));submitProposal(a,p({id:"p2",symbol:"ETHUSDT",capital:1000}));processBar(a,bar(99,101),1,costs);processBar(a,{...bar(99,101),symbol:"ETHUSDT"},1,costs);assert.equal(a.positions.length,1);assert.equal(a.pending.length,1)});

test("cancelled shadow order does not affect realized account PnL",()=>{const a=createAccount();submitProposal(a,p());processBar(a,bar(105,111,108),1,costs);assert.equal(a.shadowOrders.length,1);assert.equal(a.shadowOrders[0].realizedPnl,0);assert.equal(a.equity,10000)});
test("equity marks open positions and updates after exit",()=>{const a=createAccount();submitProposal(a,p());processBar(a,bar(99,101),1,costs);assert.ok(Number.isFinite(a.equity));processBar(a,bar(100,105,105),2,costs);assert.ok(a.equity>10000);processBar(a,bar(105,111,110),3,costs);assert.equal(a.positions.length,0);assert.equal(a.equity,a.cash)});

test("changing submitted proposal does not rewrite approved price ranges",()=>{const a=createAccount();const order=p();submitProposal(a,order);order.entry[0]=1;order.takeProfit[0]=999;assert.deepEqual(a.pending[0].entry,[99,101]);assert.deepEqual(a.pending[0].takeProfit,[110,111])});
test("short position realizes correct directional PnL",()=>{const a=createAccount();submitProposal(a,p({side:"SHORT",entry:[99,101],takeProfit:[89,90],stopLoss:[109,110]}));processBar(a,bar(99,101),1,costs);processBar(a,bar(89,100,90),2,costs);assert.equal(a.closed[0].exitReason,"TP");assert.ok(a.closed[0].pnl>0)});

test("partial entry range fills only at traded price",()=>{const a=createAccount();submitProposal(a,p());processBar(a,bar(98,99.5,99),1,costs);assert.equal(a.positions[0].entryPrice,99.5)});
test("long stop fully skipped by downward gap closes at adverse open",()=>{const a=createAccount();submitProposal(a,p());processBar(a,bar(99,101),1,costs);processBar(a,{...bar(80,85,82),open:84},2,costs);assert.equal(a.closed[0].exitReason,"SL");assert.equal(a.closed[0].exitPrice,84)});
test("short stop fully skipped by upward gap closes at adverse open",()=>{const a=createAccount();submitProposal(a,p({side:"SHORT",takeProfit:[89,90],stopLoss:[109,110]}));processBar(a,bar(99,101),1,costs);processBar(a,{...bar(115,120,118),open:116},2,costs);assert.equal(a.closed[0].exitReason,"SL");assert.equal(a.closed[0].exitPrice,116)});

test("cancelled shadow records later bars without realized PnL",()=>{const a=createAccount();submitProposal(a,p());processBar(a,bar(108,111,110),1,costs);processBar(a,bar(98,101,100),2,costs);assert.equal(a.shadowOrders.length,1);assert.equal(a.shadowOrders[0].observations.length,1);assert.equal(a.shadowOrders[0].observations[0].entryTouched,true);assert.equal(a.cash,10000);assert.equal(a.closed.length,0)});
