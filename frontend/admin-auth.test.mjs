import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {spawn} from "node:child_process";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(port){for(let i=0;i<40;i++){try{const r=await fetch("http://127.0.0.1:"+port+"/api/health");if(r.ok)return}catch{}await delay(100)}throw Error("server not ready")}
test("admin identity enforced on login, refresh, user and candles",async()=>{
 const upstream=http.createServer(async(req,res)=>{res.setHeader("Content-Type","application/json");const auth=req.headers.authorization||"";const path=req.url||"";let data={};if(path.startsWith("/auth/v1/token")){const body=await new Promise(resolve=>{let s="";req.on("data",x=>s+=x);req.on("end",()=>resolve(JSON.parse(s)))});const other=body.password==="other"||body.refresh_token==="other";data={access_token:"test",refresh_token:"test",user:{id:other?"another":"admin-uid",email:"internal@example.invalid"}}}else if(path==="/auth/v1/user"){data=auth==="Bearer other"?{id:"another",email:"internal@example.invalid"}:{id:"admin-uid",email:"internal@example.invalid"}}else if(path.startsWith("/rest/v1/raw_candles")){data=[{symbol:"BTCUSDT",close_time:1792195199999,close_price:"100"}]}else{res.statusCode=404;data={}}res.end(JSON.stringify(data))});
 await new Promise(resolve=>upstream.listen(18082,"127.0.0.1",resolve));
 const child=spawn(process.execPath,["server.mjs"],{cwd:new URL(".",import.meta.url),env:{...process.env,PORT:"18083",SUPABASE_URL:"http://127.0.0.1:18082",SUPABASE_PUBLISHABLE_KEY:"test-public",ADMIN_AUTH_EMAIL:"internal@example.invalid",ADMIN_AUTH_USER_ID:"admin-uid",ADMIN_USERNAME:"guber"}});
 const base="http://127.0.0.1:18083";
 try{
 await wait(18083);
 const send=(path,body)=>fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 assert.equal((await send("/api/auth/login",{username:"not-admin",password:"test"})).status,401);
 assert.equal((await send("/api/auth/login",{username:"guber",password:"other"})).status,403);
 assert.equal((await send("/api/auth/refresh",{refresh_token:"other"})).status,403);
 assert.equal((await fetch(base+"/api/auth/user",{headers:{Authorization:"Bearer other"}})).status,403);
 assert.equal((await fetch(base+"/api/data/candles?symbol=eq.BTCUSDT&timeframe=eq.1h",{headers:{Authorization:"Bearer other"}})).status,403);
 assert.equal((await fetch(base+"/api/data/candles?symbol=eq.BAD&timeframe=eq.1h",{headers:{Authorization:"Bearer test"}})).status,400);
 assert.equal((await send("/api/auth/login",{username:"guber",password:"test"})).status,200);
 const valid=await fetch(base+"/api/data/candles?symbol=eq.BTCUSDT&timeframe=eq.1h",{headers:{Authorization:"Bearer test"}});
 assert.equal(valid.status,200);assert.equal((await valid.json())[0].symbol,"BTCUSDT");
 }finally{child.kill();await new Promise(resolve=>upstream.close(resolve))}
});
