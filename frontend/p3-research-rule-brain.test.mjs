import test from 'node:test';
import assert from 'node:assert/strict';
import {researchRuleBrain,RESEARCH_BRAIN_VERSION} from './p3-research-rule-brain.mjs';
import {runSupabaseRuleBaselineReplay} from './p3-sequential-historical-replay.mjs';
test('research Brain refuses malformed proposals and does not fabricate confidence',async()=>{
 assert.equal(RESEARCH_BRAIN_VERSION,'P3_RULE_BRAIN_V2_EXPLORATION');
 const r=await researchRuleBrain({});
 assert.equal(r.action,'WAIT');
 assert.match(r.reason,/RULE_BRAIN_SAFETY/);
});
test('research Brain cannot be overridden with synthetic approvals',async()=>{
 await assert.rejects(runSupabaseRuleBaselineReplay({brain:async()=>({action:'APPROVE',reason:'fake'})}),/override forbidden/);
 await assert.rejects(runSupabaseRuleBaselineReplay({modelVersion:'fake'}),/override forbidden/);
});
