/** One-time trusted admin bootstrap. Run from a private operator terminal only.
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOTSTRAP_EMAIL,
 * BOOTSTRAP_PASSWORD. Never check passwords or service keys into Git.
 * Username is fixed to guber; email is an internal Supabase Auth identifier.
 */
import {createClient} from '@supabase/supabase-js';
const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','BOOTSTRAP_EMAIL','BOOTSTRAP_PASSWORD'];
for(const name of required){if(!process.env[name])throw new Error('Missing required environment variable: '+name)}
const url=process.env.SUPABASE_URL;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const email=process.env.BOOTSTRAP_EMAIL;
const password=process.env.BOOTSTRAP_PASSWORD;
if(password.length<12)throw new Error('Use a fresh password of at least 12 characters for production.');
const existing=await admin.from('app_usernames').select('user_id').eq('username','guber').maybeSingle();
if(existing.error)throw existing.error;
if(existing.data)throw new Error('Username already provisioned; refusing to overwrite existing account.');
const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
if(error||!data.user)throw error??new Error('User creation failed');
const id=data.user.id;
try{
 const userRow=await admin.from('app_usernames').insert({username:'guber',user_id:id});
 if(userRow.error)throw userRow.error;
 const roleRow=await admin.from('app_user_roles').insert({user_id:id,role:'ADMIN'});
 if(roleRow.error)throw roleRow.error;
 console.log('Initial administrator provisioned successfully.');
}catch(err){
 console.error('Provisioning incomplete. Inspect username/role mappings and Auth user before retrying.');
 throw err;
}
