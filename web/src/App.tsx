import React, {useEffect,useState} from 'react';
import {supabase,getDisplayRole} from './auth';
import {Login} from './Login';
import {TrainingSettings} from './TrainingSettings';
import {TrainingMonitor} from './TrainingMonitor';
import {TrainingBatch} from './TrainingBatch';
import {GenerationHistory} from './GenerationHistory';
import {Activity, BrainCircuit, ChartNoAxesCombined, CircleUserRound, Database, Gauge, LayoutDashboard, Settings2, ShieldCheck} from 'lucide-react';

const navigation = [
  {name:'總覽',icon:LayoutDashboard}, {name:'AI 訓練',icon:BrainCircuit},
  {name:'模型績效',icon:ChartNoAxesCombined}, {name:'市場狀態',icon:Activity},
  {name:'資料健康度',icon:Database}, {name:'系統設定',icon:Settings2}
];
const cards = [
  {label:'系統環境',value:'模擬研究',detail:'無真實資金交易'},
  {label:'目前訓練排程',value:'尚未連線',detail:'尚未讀取執行狀態'},
  {label:'訓練標的',value:'尚未連線',detail:'尚未讀取資料來源'},
  {label:'策略週期',value:'尚未連線',detail:'尚未讀取模型設定'}
];
export function App(){
  const [page,setPage]=useState('總覽');
  const [signedIn,setSignedIn]=useState(false);
  const [loading,setLoading]=useState(true);
  const [role,setRole]=useState('VIEWER');
  const [dataCounts,setDataCounts]=useState<{candles:number|null;features:number|null}>({candles:null,features:null});
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
  useEffect(()=>{if(!signedIn||!supabase)return;
    let alive=true;
    async function loadCounts(){
      const [candles,features]=await Promise.all([
        supabase!.from('raw_candles').select('*',{count:'exact',head:true}),
        supabase!.from('market_features').select('*',{count:'exact',head:true})
      ]);
      if(alive)setDataCounts({candles:candles.error?null:candles.count,features:features.error?null:features.count});
    }
    void loadCounts();return()=>{alive=false};
  },[signedIn]);
  if(loading)return <div className="loading-screen">正在檢查登入狀態…</div>;
  if(!signedIn)return <Login onLogin={()=>{setSignedIn(true);void getDisplayRole().then(setRole)}}/>;
  const visiblePage=role==='ADMIN'||!['AI 訓練','系統設定','資料健康度'].includes(page)?page:'總覽';
  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-icon"><Activity size={21}/></div><div><strong>AI 交易系統</strong><small>管理中心</small></div></div><div className="nav-title">功能選單</div><nav aria-label="主選單">{navigation.filter(item=>role==='ADMIN'||!['AI 訓練','系統設定','資料健康度'].includes(item.name)).map(({name,icon:Icon})=><button key={name} className={visiblePage===name?'nav-item active':'nav-item'} onClick={()=>setPage(name)}><Icon size={17}/>{name}</button>)}</nav><div className="sidebar-bottom"><ShieldCheck size={16}/> 登入身分：{role==='ADMIN'?'管理員':'檢視者'}</div></aside><main className="main"><header className="topbar"><span className="crumb">管理中心 / {visiblePage}</span><div className="top-actions"><span className="paper"><span className="dot"/>模擬模式</span><button className="logout" onClick={()=>{void supabase?.auth.signOut().then(()=>setSignedIn(false))}}><CircleUserRound size={17}/> 登出</button></div></header><section className="content"><div className="heading"><div><p className="eyebrow">系統總覽</p><h1>{visiblePage}</h1><p className="subtitle">AI 模型訓練、交易研究與模擬績效監控</p></div><span className="preview">部分功能已連線 · 其餘功能開發中</span></div>{visiblePage==='系統設定'?<TrainingSettings/>:visiblePage==='AI 訓練'?<><article className="panel section"><TrainingBatch/></article><article className="panel section"><GenerationHistory/></article><article className="panel section"><TrainingMonitor/></article></>:<><div className="kpis">{cards.map(c=><article className="panel kpi" key={c.label}><div className="label">{c.label}</div><div className="value">{c.value}</div><div className="detail">{c.detail}</div></article>)}</div><div className="two-col"><article className="panel section"><div className="section-head"><div><h2>資料庫筆數</h2><p>從 Supabase 查詢，無讀取權限則顯示未開放</p></div></div><div className="status-row"><span>原始 K 線</span><span>{dataCounts.candles===null?'尚未開放讀取':dataCounts.candles.toLocaleString()}</span></div><div className="status-row"><span>特徵資料</span><span>{dataCounts.features===null?'尚未開放讀取':dataCounts.features.toLocaleString()}</span></div></article><article className="panel section"><div className="section-head"><div><h2>AI 模型績效</h2><p>目前尚未連接經驗證的績效資料介面</p></div><span className="chip">尚無資料</span></div><div className="empty-chart"><ChartNoAxesCombined size={34}/><strong>等待真實績效資料</strong><span>不使用示意曲線冒充回測成果</span></div></article><article className="panel section"><div className="section-head"><div><h2>系統狀態</h2><p>各模組即時健康度</p></div><Gauge size={20}/></div>{['市場資料收集','特徵指標計算','模型訓練','模擬交易'].map(x=><div className="status-row" key={x}><span>{x}</span><span className="unknown">尚未連線</span></div>)}</article></div><article className="panel section"><div className="section-head"><div><h2>模型實驗紀錄</h2><p>將顯示 訓練／驗證／保留測試／前向模擬</p></div><span className="chip">僅供查看</span></div><div className="table-wrap"><table><thead><tr><th>交易對</th><th>策略週期</th><th>資料區間</th><th>淨報酬</th><th>最大回撤</th><th>狀態</th></tr></thead><tbody><tr><td colSpan={6} className="empty-table">尚未串接實驗紀錄資料源</td></tr></tbody></table></div></article><p className="footnote">此版本已包含 Supabase 身分驗證登入與角色介面；市場資料仍為靜態預覽。管理操作尚未開放，亦不涉及真實交易。</p></>}</section></main></div>
}
