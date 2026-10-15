import React, {useState} from 'react';
import {Activity, BrainCircuit, ChartNoAxesCombined, CircleUserRound, Database, Gauge, LayoutDashboard, Settings2, ShieldCheck} from 'lucide-react';

const navigation = [
  {name:'總覽',icon:LayoutDashboard}, {name:'AI 訓練',icon:BrainCircuit},
  {name:'模型績效',icon:ChartNoAxesCombined}, {name:'市場狀態',icon:Activity},
  {name:'資料健康度',icon:Database}, {name:'系統設定',icon:Settings2}
];
const cards = [
  {label:'系統環境',value:'PAPER',detail:'無真實資金交易'},
  {label:'目前訓練排程',value:'6 小時',detail:'GitHub Actions 暫行排程'},
  {label:'訓練標的',value:'2',detail:'BTCUSDT · ETHUSDT'},
  {label:'策略週期',value:'4',detail:'15m · 1h · 4h · 1d'}
];
export function App(){
  const [page,setPage]=useState('總覽');
  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-icon"><Activity size={21}/></div><div><strong>AI Trading</strong><small>CONTROL CENTER</small></div></div><div className="nav-title">WORKSPACE</div><nav aria-label="主選單">{navigation.map(({name,icon:Icon})=><button key={name} className={page===name?'nav-item active':'nav-item'} onClick={()=>setPage(name)}><Icon size={17}/>{name}</button>)}</nav><div className="sidebar-bottom"><ShieldCheck size={16}/> 本機 UI 預覽 · 未登入</div></aside><main className="main"><header className="topbar"><span className="crumb">Workspace / {page}</span><div className="top-actions"><span className="paper"><span className="dot"/>PAPER MODE</span><CircleUserRound size={22} aria-label="尚未登入"/></div></header><section className="content"><div className="heading"><div><p className="eyebrow">SYSTEM OVERVIEW</p><h1>{page}</h1><p className="subtitle">AI 模型訓練、交易研究與模擬績效監控</p></div><span className="preview">靜態介面預覽 · 尚未串接後端</span></div><div className="kpis">{cards.map(c=><article className="panel kpi" key={c.label}><div className="label">{c.label}</div><div className="value">{c.value}</div><div className="detail">{c.detail}</div></article>)}</div><div className="two-col"><article className="panel section"><div className="section-head"><div><h2>AI 模型績效</h2><p>目前尚未連接經驗證的績效 API</p></div><span className="chip">NO DATA</span></div><div className="empty-chart"><ChartNoAxesCombined size={34}/><strong>等待真實績效資料</strong><span>不使用示意曲線冒充回測成果</span></div></article><article className="panel section"><div className="section-head"><div><h2>系統狀態</h2><p>各模組即時健康度</p></div><Gauge size={20}/></div>{['市場資料收集','Features 計算','模型訓練','模擬交易'].map(x=><div className="status-row" key={x}><span>{x}</span><span className="unknown">尚未連線</span></div>)}</article></div><article className="panel section"><div className="section-head"><div><h2>模型實驗紀錄</h2><p>將顯示 TRAIN / VALIDATION / HOLDOUT / FORWARD PAPER</p></div><span className="chip">READ ONLY</span></div><div className="table-wrap"><table><thead><tr><th>交易對</th><th>策略週期</th><th>資料區間</th><th>淨報酬</th><th>最大回撤</th><th>狀態</th></tr></thead><tbody><tr><td colSpan={6} className="empty-table">尚未串接實驗紀錄資料源</td></tr></tbody></table></div></article><p className="footnote">此版本僅為前端 UI 骨架，沒有登入、管理權限、資料庫寫入或真實交易功能。</p></section></main></div>
}
