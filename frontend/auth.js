let session=null;
const storageKey="uber-v2-session";
async function call(endpoint,body=null,token=""){const response=await fetch("/api/auth/"+endpoint,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.message||"驗證失敗");return data}
export function isConfigured(){return true}
export function currentSession(){return session}
export async function restoreSession(){let saved;try{saved=JSON.parse(sessionStorage.getItem(storageKey)||"null")}catch{return null}if(!saved?.refresh_token)return null;try{const next=await call("refresh",{refresh_token:saved.refresh_token});setSession(next);return session}catch{clearSession();return null}}
export async function signIn(username,password){const next=await call("login",{username,password});setSession(next);return session}
export async function signOut(){if(session?.access_token){try{await fetch("/api/auth/logout",{method:"POST",headers:{Authorization:"Bearer "+session.access_token}})}catch{}}clearSession()}
export async function getUser(){if(!session?.access_token)return null;try{return await call("user",null,session.access_token)}catch{clearSession();return null}}
function setSession(next){session={access_token:next.access_token,refresh_token:next.refresh_token,user:next.user};sessionStorage.setItem(storageKey,JSON.stringify(session))}
function clearSession(){session=null;sessionStorage.removeItem(storageKey)}
