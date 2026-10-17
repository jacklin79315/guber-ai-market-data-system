import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileP4ResearchProgress} from './p4-progress-reconcile.mjs';
test('P4 restart recovers one durable round after interrupted checkpoint write',()=>{const result=reconcileP4ResearchProgress({checkpoint:{phase:'RESEARCH',completedIterations:1},rounds:[{iteration:1},{iteration:2}]});assert.equal(result.completedIterations,2);assert.equal(result.recoveredUncheckpointedRound,true)});
test('P4 restart refuses gaps and more than one lagging round',()=>{assert.throws(()=>reconcileP4ResearchProgress({checkpoint:{phase:'RESEARCH',completedIterations:1},rounds:[{iteration:1},{iteration:2},{iteration:3}]}),/mismatch/);assert.throws(()=>reconcileP4ResearchProgress({checkpoint:{phase:'RESEARCH',completedIterations:0},rounds:[{iteration:2}]}),/gap/)});
test('P4 completed checkpoint cannot silently disagree with round ledger',()=>{assert.throws(()=>reconcileP4ResearchProgress({checkpoint:{phase:'COMPLETED',completedIterations:1},rounds:[{iteration:1},{iteration:2}]}),/completed checkpoint mismatch/)});
