// Supabase Edge Function: username login. Deployment intentionally deferred until
// rate limiting, CORS allowlist, secrets and end-to-end tests are configured.
import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
Deno.serve(async(request)=>{
 const origin=request.headers.get('origin')??'';
 const allowed=(Deno.env.get('ALLOWED_WEB_ORIGIN')??'').split(',').map(x=>x.trim()).filter(Boolean);
 const cors={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null','Vary':'Origin','Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST'||!allowed.includes(origin))return new Response('Forbidden',{status:403,headers:cors});
 const invalid=()=>new Response(JSON.stringify({error:'Invalid credentials'}),{status:401,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 try{
  const body=await request.json();
  const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  if(!/^[a-z0-9_]{3,40}$/.test(username)||!password||password.length>1024)return invalid();
  // TODO SECURITY GATE: enforce server-side per-IP and per-username rate limits before deployment.
  const url=Deno.env.get('SUPABASE_URL')!;
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const publishable=Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const limiter=await admin.rpc('app_claim_login_attempt',{p_username:username});
  if(limiter.error||limiter.data!==true)return invalid();
  const mapping=await admin.from('app_usernames').select('user_id').eq('username',username).maybeSingle();
  if(mapping.error||!mapping.data)return invalid();
  // Auth email must be fetched server-side, never returned to client.
  const user=await admin.auth.admin.getUserById(mapping.data.user_id);
  if(user.error||!user.data.user?.email)return invalid();
  const client=createClient(url,publishable,{auth:{autoRefreshToken:false,persistSession:false}});
  const result=await client.auth.signInWithPassword({email:user.data.user.email,password});
  if(result.error||!result.data.session)return invalid();
  return new Response(JSON.stringify({access_token:result.data.session.access_token,refresh_token:result.data.session.refresh_token}),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch{return invalid()}
});
