import test from 'node:test';
import assert from 'node:assert/strict';
import {createP4CheckpointStore,createP4Checkpoint} from './p4-checkpoints.mjs';
test('P4 checkpoints roundtrip through supplied durable adapter',async()=>{const rows=new Map();const store=createP4CheckpointStore({read:async id=>rows.get(id),write:async(id,data)=>{rows.set(id,data)}});const cp=createP4Checkpoint({jobId:'job-1',phase:'RESEARCH',completedWindows:3,loadedCandles:25000,completedIterations:2,updatedAtMs:123});await store.save(cp);const restored=await store.load('job-1');assert.deepEqual(restored,cp);restored.completedIterations=99;assert.equal((await store.load('job-1')).completedIterations,2)});
test('P4 checkpoint store rejects corrupt records',async()=>{const store=createP4CheckpointStore({read:async()=>({jobId:'wrong'}),write:async()=>{}});await assert.rejects(store.load('job-1'),/invalid P4 checkpoint/)});
test('P4 checkpoint store requires real adapter functions',()=>{assert.throws(()=>createP4CheckpointStore({read:async()=>null}),/adapter required/)});
