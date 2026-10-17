import http from "node:http";
import {createHmac,timingSafeEqual} from "node:crypto";
import {ROLES,publicIdentity} from "./access-policy.mjs";
import {parseViewers,identifyUsername,identifyUser} from "./role-identity.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||8080);
const url=process.env.SUPABASE_URL||"";
const key=process.env.SUPABASE_PUBLISHABLE_KEY||"";
const alias=process.env.ADMIN_AUTH_EMAIL||"";
const adminName=process.env.ADMIN_USERNAME||"guber";
const adminId=process.env.ADMIN_AUTH_USER_ID||"";
const viewers=parseViewers(process.env.VIEWER_AUTH_USERS_JSON||"");
const loginAttempts=new Map();
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".jpg":"image/jpeg",".png":"image/png",".svg":"image/svg+xml"};
function send(res,status,data){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(data))}
async function body(req){let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>8192){const e=Error("要求過大");e.status=413;throw e}}let value;try{value=JSON.parse(raw||"{}")}catch{const e=Error("JSON 格式錯誤");e.status=400;throw e}if(!value||typeof value!=="object"||Array.isArray(value)){const e=Error("要求格式錯誤");e.status=400;throw e}return value}
const signingSecret=process.env.P1_SESSION_SECRET||"";
function signToken(username,role,kind,seconds){const payload=Buffer.from(JSON.stringify({username,role,kind,exp:Math.floor(Date.now()/1000)+seconds})).toString("base64url");const signature=createHmac("sha256",signingSecret).update(payload).digest("base64url");return payload+"."+signature}
function sessionUser(req,kind="access"){if(!signingSecret)return null;const bearer=req.headers.authorization||"";if(!bearer.startsWith("Bearer "))return null;const parts=bearer.slice(7).split(".");if(parts.length!==2)return null;const expected=createHmac("sha256",signingSecret).update(parts[0]).digest();let actual;try{actual=Buffer.from(parts[1],"base64url")}catch{return null}if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;try{const data=JSON.parse(Buffer.from(parts[0],"base64url").toString());if(data.kind!==kind||data.exp<=Date.now()/1000||!["admin","viewer"].includes(data.role))return null;return data}catch{return null}}
function issueTokens(username,role){return {access_token:signToken(username,role,"access",3600),refresh_token:signToken(username,role,"refresh",604800),user:{username,role}}}
async function auth(req,res,pathname){
 if(!url||!key||!signingSecret){send(res,503,{message:"登入服務尚未設定"});return}
 if(pathname==="/api/auth/login"){
  if(req.method!=="POST"){send(res,405,{message:"不支援的方法"});return}
  const b=await body(req);const ip=req.socket.remoteAddress||"unknown";const now=Date.now();const attempts=(loginAttempts.get(ip)||[]).filter(t=>now-t<900000);
  if(attempts.length>=8){send(res,429,{message:"登入嘗試過於頻繁"});return}
  attempts.push(now);loginAttempts.set(ip,attempts);
  if(loginAttempts.size>1000)loginAttempts.clear();
  if(typeof b.username!=="string"||typeof b.password!=="string"){send(res,401,{message:"帳號或密碼不正確"});return}
  const result=await fetch(url+"/rest/v1/rpc/p1_verify_login",{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({p_username:b.username,p_password:b.password})});
  if(!result.ok){send(res,503,{message:"資料庫登入驗證服務暫時無法使用"});return}
  const users=await result.json();if(!Array.isArray(users)||!users[0]){send(res,401,{message:"帳號或密碼不正確"});return}
  loginAttempts.delete(ip);send(res,200,issueTokens(users[0].username,users[0].role));return
 }
 if(pathname==="/api/auth/refresh"){
  if(req.method!=="POST"){send(res,405,{message:"不支援的方法"});return}
  const b=await body(req);const fake={headers:{authorization:"Bearer "+(b.refresh_token||"")}};const user=sessionUser(fake,"refresh");
  if(!user){send(res,401,{message:"登入已失效"});return}send(res,200,issueTokens(user.username,user.role));return
 }
 if(pathname==="/api/auth/logout"){send(res,200,{ok:true});return}
 if(pathname==="/api/auth/user"){const user=sessionUser(req);if(!user){send(res,401,{message:"請先登入"});return}send(res,200,{username:user.username,role:user.role});return}
 send(res,404,{message:"找不到服務"})
}
async function candles(req,res,params){if(!url||!key||!signingSecret){send(res,503,{message:"資料服務尚未設定"});return}const identity=sessionUser(req);if(!identity){send(res,401,{message:"請先登入"});return}const h={apikey:key};const headers=h;const symbol=(params.get("symbol")||"").replace(/^eq\./,"");const timeframe=(params.get("timeframe")||"").replace(/^eq\./,"");const allowed=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","PENGUUSDT"];if(!allowed.includes(symbol)||!["15m","1h","4h","1d"].includes(timeframe)){send(res,400,{message:"商品或週期不支援"});return}const limit=Math.max(1,Math.min(100,Number(params.get("limit"))||1));const query=new URLSearchParams({select:"symbol,timeframe,open_time,close_time,open_price,high_price,low_price,close_price,base_volume",symbol:"eq."+symbol,timeframe:"eq."+timeframe,order:"open_time.desc",limit:String(limit)});const dataResponse=await fetch(url+"/rest/v1/raw_candles?"+query,{headers:h});if(!dataResponse.ok){send(res,dataResponse.status,{message:"行情資料讀取失敗"});return}send(res,200,await dataResponse.json())}
async function watchlist(req,res){if(!url||!key||!signingSecret){send(res,503,{message:"資料服務尚未設定"});return}const identity=sessionUser(req);if(!identity){send(res,401,{message:"請先登入"});return}const h={apikey:key};const headers=h;const query=new URLSearchParams({select:"symbol,enabled,intervals,lookback_years,source,market",order:"symbol.asc",limit:"100"});const response=await fetch(url+"/rest/v1/market_data_watchlist?"+query,{headers:h});if(!response.ok){send(res,response.status,{message:"監測清單讀取失敗"});return}send(res,200,await response.json())}
async function ingestionJobs(req,res){if(!url||!key||!signingSecret){send(res,503,{message:"資料服務尚未設定"});return}const identity=sessionUser(req);if(!identity){send(res,401,{message:"請先登入"});return}const h={apikey:key};const headers=h;const query=new URLSearchParams({select:"id,job_type,symbol,timeframe,status,inserted_count,duplicate_count,issue_count,error_message,requested_at,started_at,completed_at",order:"requested_at.desc",limit:"30"});const response=await fetch(url+"/rest/v1/ingestion_jobs?"+query,{headers:h});if(!response.ok){send(res,response.status,{message:"回補任務讀取失敗"});return}send(res,200,await response.json())}
http.createServer(async(req,res)=>{try{const u=new URL(req.url||"/","http://localhost");if(u.pathname==="/api/health"){send(res,200,{status:"ok",authConfigured:Boolean(url&&key&&signingSecret)});return}if(u.pathname==="/api/data/ingestion-jobs"){if(req.method!=="GET"){send(res,405,{message:"僅支援唯讀查詢"});return}await ingestionJobs(req,res);return}if(u.pathname==="/api/data/watchlist"){if(req.method!=="GET"){send(res,405,{message:"僅支援唯讀查詢"});return}await watchlist(req,res);return}if(u.pathname==="/api/data/candles"){if(req.method!=="GET"){send(res,405,{message:"僅支援唯讀查詢"});return}await candles(req,res,u.searchParams);return}if(u.pathname.startsWith("/api/auth/")){await auth(req,res,u.pathname);return}if(req.method!=="GET"&&req.method!=="HEAD"){send(res,405,{message:"不支援的方法"});return}const pathname=u.pathname==="/"?"/index.html":u.pathname;if(pathname.endsWith(".mjs")||pathname==="/README.md"||pathname==="/package.json"||pathname.startsWith("/.")){send(res,404,{message:"找不到檔案"});return}const target=path.resolve(root,"."+pathname);if(!target.startsWith(root+path.sep)){send(res,403,{message:"禁止存取"});return}const data=await fs.readFile(target);res.writeHead(200,{"Content-Type":types[path.extname(target)]||"application/octet-stream","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer","Cache-Control":"no-store","Content-Security-Policy":"default-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; style-src 'self'; script-src 'self'; base-uri 'none'; object-src 'none'"});res.end(req.method==="HEAD"?undefined:data)}catch(e){send(res,e.status|| (e.code==="ENOENT"?404:500),{message:e.status?e.message:"服務暫時無法使用"})}}).listen(port,"0.0.0.0",()=>console.log("Frontend listening on "+port));
