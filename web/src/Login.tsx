import React,{useState} from 'react';
import {supabase} from './auth';
export function Login({onLogin}:{onLogin:()=>void}){
 const [username,setUsername]=useState('');const [password,setPassword]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function submit(event:React.FormEvent){event.preventDefault();setError('');setBusy(true);
 try{if(!supabase)throw Error('not configured');
 // A trusted server endpoint resolves usernames and verifies credentials; never resolve them in the browser.
 const endpoint=import.meta.env.VITE_AUTH_ENDPOINT;
 if(!endpoint)throw Error('not configured');
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
 if(!response.ok)throw Error('invalid credentials');
 const payload=await response.json();
 if(typeof payload.access_token!=='string'||typeof payload.refresh_token!=='string')throw Error('invalid session');
 const result=await supabase.auth.setSession({access_token:payload.access_token,refresh_token:payload.refresh_token});
 if(result.error)throw result.error;
 onLogin();
 }catch{setError('無法登入，請確認帳號密碼或系統設定。');}finally{setBusy(false)} }
 return <main className="login-page"><form className="login-card" onSubmit={submit}>
 <div className="login-mark">AI TRADING / CONTROL CENTER</div><h1>登入平台</h1><p>輸入管理者或一般使用者帳號。</p>
 <label htmlFor="username">帳號</label><input id="username" required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/>
 <label htmlFor="password">密碼</label><input id="password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/>
 {error&&<div role="alert" className="login-error">{error}</div>}
 <button disabled={busy||!supabase||!import.meta.env.VITE_AUTH_ENDPOINT}>{busy?'驗證中…':'登入'}</button>
 {!import.meta.env.VITE_AUTH_ENDPOINT&&<p className="login-error">登入服務尚未部署，暫時無法登入。</p>}
 <small>研究與模擬交易平台，不提供真實資金下單。</small>
 </form></main>
}
