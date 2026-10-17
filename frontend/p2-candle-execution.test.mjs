import test from "node:test";
import assert from "node:assert/strict";
import {resolveExit,spotNetReturn} from "./p2-candle-execution.mjs";
test("no trigger",()=>{assert.equal(resolveExit({high:105,low:95,close:100,stopLoss:90,takeProfit:110}).exit,"HOLD")});
test("dual trigger follows close proximity",()=>{assert.equal(resolveExit({high:112,low:88,close:108,stopLoss:90,takeProfit:110}).exit,"TP");assert.equal(resolveExit({high:112,low:88,close:100,stopLoss:90,takeProfit:110}).exit,"SL")});
test("costs reduce returns",()=>{assert.equal(spotNetReturn({entry:100,exit:100,feeRate:0,slippageRate:0}),0);assert.ok(spotNetReturn({entry:100,exit:110,feeRate:0.001,slippageRate:0.001})<0.1)});
