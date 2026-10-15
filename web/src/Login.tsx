import React,{useState} from 'react';
import {supabase} from './auth';
export function Login({onLogin}:{onLogin:()=>void}){
 const [username,setUsername]=useState('');const [password,setPassword]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function submit(event:React.FormEvent){event.preventDefault();setError('');setBusy(true);
 try{if(!supabase)throw Error('not configured');
 const domain=import.meta.env.VITE_AUTH_EMAIL_DOMAIN;
 if(!domain||!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))throw Error('not configured');
 const name=username.trim().toLowerCase();
 if(!/^[a-z0-9_]{3,40}$/.test(name))throw Error('invalid username');
 const result=await supabase.auth.signInWithPassword({email:name+'@'+domain,password});
 if(result.error||!result.data.session)throw Error('invalid credentials');
 onLogin();
 }catch{setError('無法登入，請確認帳號密碼或系統設定。');}finally{setBusy(false)} }
 return <main className="login-page"><form className="login-card" onSubmit={submit}>
 <div className="login-mark">AI TRADING / CONTROL CENTER</div><h1>登入平台</h1><p>輸入管理者或一般使用者帳號。</p>
 <label htmlFor="username">帳號</label><input id="username" required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/>
 <label htmlFor="password">密碼</label><input id="password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/>
 {error&&<div role="alert" className="login-error">{error}</div>}
 <button disabled={busy||!supabase||!import.meta.env.VITE_AUTH_EMAIL_DOMAIN}>{busy?'驗證中…':'登入'}</button>
 {!import.meta.env.VITE_AUTH_EMAIL_DOMAIN&&<p className="login-error">尚未設定登入環境，請先完成網站設定。</p>}
 <small>研究與模擬交易平台，不提供真實資金下單。</small>
 </form></main>
}
