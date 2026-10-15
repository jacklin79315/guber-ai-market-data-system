import React, {useEffect,useState} from 'react';
import {supabase,getDisplayRole} from './auth';
import {Login} from './Login';
import {Activity, BrainCircuit, ChartNoAxesCombined, CircleUserRound, Database, Gauge, LayoutDashboard, Settings2, ShieldCheck} from 'lucide-react';

const navigation = [
  {name:'總覽',icon:LayoutDashboard}, {name:'AI 訓練',icon:BrainCircuit},
  {name:'模型績效',icon:ChartNoAxesCombined}, {name:'市場狀態',icon:Activity},
  {name:'資料健康度',icon:Database}, {name:'系統設定',icon:Settings2}
];
const cards = [
  {label:'系統環境',value:'PAPER',detail:'無真實資金交易'},
  {label:'目前訓練排程',value:'尚未連線',detail:'GitHub Actions 暫行排程'},
  {label:'訓練標的',value:'尚未連線',detail:'BTCUSDT · ETHUSDT'},
  {label:'策略週期',value:'尚未連線',detail:'15m · 1h · 4h · 1d'}
];
export function App(){
  const [page,setPage]=useState('總覽');
  const [signedIn,setSignedIn]=useState(false);
  const [loading,setLoading]=useState(true);
  const [role,setRole]=useState('VIEWER');
  useEffect(()=>{let alive=true;
    async function refresh(){if(!supabase){if(alive)setLoading(false);return;}
      const {data}=await supabase.auth.getSession();if(!alive)return;
      const verified=data.session?await supabase.auth.getUser():null;
      if(!alive)return;
      setSignedIn(!!verified?.data.user&&!verified.error);
      setRole(verified?.data.user&&!verified.error?await getDisplayRole():'VIEWER');setLoading(false);
    }
    void refresh();const {data:listener}=supabase?.auth.onAuthStateChange(()=>{queueMicrotask(()=>{void refresh()})})??{data:null};
    return ()=>{alive=false;listener?.subscription.unsubscribe()};
  },[]);
  if(loading)return <div className="loading-screen">正在檢查登入狀態…</div>;
  if(!signedIn)return <Login onLogin={()=>{setSignedIn(true);void getDisplayRole().then(setRole)}}/>;
  const visiblePage=role==='ADMIN'||!['AI 訓練','系統設定','資料健康度'].includes(page)?page:'總覽';
  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-icon"><Activity size={21}/></div><div><strong>AI Trading</strong><small>CONTROL CENTER</small></div></div><div className="nav-title">WORKSPACE</div><nav aria-label="主選單">{navigation.filter(item=>role==='ADMIN'||!['AI 訓練','系統設定','資料健康度'].includes(item.name)).map(({name,icon:Icon})=><button key={name} className={visiblePage===name?'nav-item active':'nav-item'} onClick={()=>setPage(name)}><Icon size={17}/>{name}</button>)}</nav><div className="sidebar-bottom"><ShieldCheck size={16}/> 登入身分：{role}</div></aside><main className="main"><header className="topbar"><span className="crumb">Workspace / {visiblePage}</span><div className="top-actions"><span className="paper"><span className="dot"/>PAPER MODE</span><button className="logout" onClick={()=>{void supabase?.auth.signOut().then(()=>setSignedIn(false))}}><CircleUserRound size={17}/> 登出</button></div></header><section className="content"><div className="heading"><div><p className="eyebrow">SYSTEM OVERVIEW</p><h1>{visiblePage}</h1><p className="subtitle">AI 模型訓練、交易研究與模擬績效監控</p></div><span className="preview">靜態介面預覽 · 尚未串接後端</span></div><div className="kpis">{cards.map(c=><article className="panel kpi" key={c.label}><div className="label">{c.label}</div><div className="value">{c.value}</div><div className="detail">{c.detail}</div></article>)}</div><div className="two-col"><article className="panel section"><div className="section-head"><div><h2>AI 模型績效</h2><p>目前尚未連接經驗證的績效 API</p></div><span className="chip">NO DATA</span></div><div className="empty-chart"><ChartNoAxesCombined size={34}/><strong>等待真實績效資料</strong><span>不使用示意曲線冒充回測成果</span></div></article><article className="panel section"><div className="section-head"><div><h2>系統狀態</h2><p>各模組即時健康度</p></div><Gauge size={20}/></div>{['市場資料收集','Features 計算','模型訓練','模擬交易'].map(x=><div className="status-row" key={x}><span>{x}</span><span className="unknown">尚未連線</span></div>)}</article></div><article className="panel section"><div className="section-head"><div><h2>模型實驗紀錄</h2><p>將顯示 TRAIN / VALIDATION / HOLDOUT / FORWARD PAPER</p></div><span className="chip">READ ONLY</span></div><div className="table-wrap"><table><thead><tr><th>交易對</th><th>策略週期</th><th>資料區間</th><th>淨報酬</th><th>最大回撤</th><th>狀態</th></tr></thead><tbody><tr><td colSpan={6} className="empty-table">尚未串接實驗紀錄資料源</td></tr></tbody></table></div></article><p className="footnote">此版本已包含 Supabase Auth 登入與角色介面；市場資料仍為靜態預覽。管理操作尚未開放，亦不涉及真實交易。</p></section></main></div>
}
