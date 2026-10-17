import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPERT_ORDER,applyExpertPatch,createProposalContext} from './p3-contract.mjs';
test('P3 follows five-expert sequence',()=>{assert.deepEqual(EXPERT_ORDER,['entry','reward','winProbability','riskPosition','time'])});
test('expert may only write owned fields',()=>{const base={id:'p1'};const entry=applyExpertPatch('entry',base,{symbol:'BTCUSDT',side:'LONG',timeframe:'1h',entryRange:[100,101],entryReason:'signal'});assert.equal(entry.symbol,'BTCUSDT');assert.throws(()=>applyExpertPatch('reward',entry,{tpRange:[110,111],slRange:[95,96],riskReward:2,expectedGain:10,expectedLoss:5,rewardReason:'levels',entryRange:[90,91]}),/ownership/)});
test('market snapshot cannot be from the future',()=>{assert.throws(()=>createProposalContext({id:'p1',decisionTime:100,marketSnapshot:{asOfMs:101},modelVersion:'v1'}),/context/);const p=createProposalContext({id:'p1',decisionTime:100,marketSnapshot:{asOfMs:100},modelVersion:'v1'});assert.equal(p.marketSnapshot.asOfMs,100)});
