import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {spawn} from "node:child_process";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(port){for(let i=0;i<40;i++){try{const r=await fetch("http://127.0.0.1:"+port+"/api/health");if(r.ok)return}catch{}await delay(100)}throw Error("server not ready")}
test("signed-session authentication rejects unsigned requests",async()=>{
 const child=spawn(process.execPath,["server.mjs"],{cwd:new URL(".",import.meta.url),env:{...process.env,PORT:"18083",SUPABASE_URL:"http://127.0.0.1:18082",SUPABASE_PUBLISHABLE_KEY:"test-public",P1_SESSION_SECRET:"test-only-signing-secret"}});
 try{await wait(18083);const base="http://127.0.0.1:18083";assert.equal((await fetch(base+"/api/auth/user")).status,401);assert.equal((await fetch(base+"/api/data/candles?symbol=eq.BTCUSDT&timeframe=eq.1h")).status,401)}finally{child.kill()}
});
