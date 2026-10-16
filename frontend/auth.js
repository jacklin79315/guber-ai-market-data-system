import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,configured} from "./config.js";
let session=null;
const storageKey="uber-v2-session";
function headers(token){return {"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY,...(token?{"Authorization":"Bearer "+token}:{})}}
async function request(path,options={}){const res=await fetch(SUPABASE_URL+"/auth/v1/"+path,{...options,headers:{...headers(options.token),...(options.headers||{})}});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.msg||data.error_description||data.message||"驗證服務暫時無法使用");return data}
export function isConfigured(){return configured}
export function currentSession(){return session}
export async function restoreSession(){if(!configured)return null;let saved;try{saved=JSON.parse(sessionStorage.getItem(storageKey)||"null")}catch{return null}if(!saved?.refresh_token)return null;try{const next=await request("token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:saved.refresh_token})});setSession(next);return session}catch{clearSession();return null}}
export async function signIn(email,password){if(!configured)throw Error("尚未設定安全連線");const next=await request("token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});setSession(next);return session}
export async function signOut(){if(session?.access_token){try{await request("logout",{method:"POST",token:session.access_token})}catch{}}clearSession()}
function setSession(next){session={access_token:next.access_token,refresh_token:next.refresh_token,user:next.user};sessionStorage.setItem(storageKey,JSON.stringify(session))}
function clearSession(){session=null;sessionStorage.removeItem(storageKey)}
export async function getUser(){if(!session?.access_token)return null;try{return await request("user",{token:session.access_token})}catch{clearSession();return null}}
