import test from 'node:test';
import assert from 'node:assert/strict';
import {runP4AutonomousResearchLoop} from './p4-autonomous-research-loop.mjs';
const safe=id=>({jobId:id,ordersEnabled:false,modelUpdateApplied:false,championPromotionAllowed:false});
const ready={status:'READY',researchOnly:true,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
test('autonomous rounds feed persisted results into the next plan',async()=>{
 const seen=[];
 const result=await runP4AutonomousResearchLoop({confirm:'RESEARCH_ONLY',initialSummary:safe('seed'),maxRounds:3,planNext:async({summary})=>{seen.push(summary.jobId);return ready;},executeRound:async({round})=>({status:'COMMITTED',summary:safe('round_'+round)})});
 assert.deepEqual(seen,['seed','round_1','round_2']);
 assert.equal(result.completedRounds,3);
});
test('stops on insufficient evidence',async()=>{
 const result=await runP4AutonomousResearchLoop({confirm:'RESEARCH_ONLY',initialSummary:safe('seed'),maxRounds:3,planNext:async()=>({status:'BLOCKED',reason:'NO_EVIDENCE'}),executeRound:async()=>{throw Error('unexpected execution');}});
 assert.equal(result.completedRounds,0);
});
