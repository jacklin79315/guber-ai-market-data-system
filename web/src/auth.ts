import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export async function getDisplayRole(){
 if(!supabase)return 'VIEWER';
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)return 'VIEWER';
 const result=await supabase.from('app_user_roles').select('role').eq('user_id',user.id).maybeSingle();
 return result.error? 'VIEWER': result.data?.role==='ADMIN'?'ADMIN':'VIEWER';
}
