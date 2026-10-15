import React,{useEffect,useState} from 'react';
import {supabase} from './auth';

type Model={strategy:string;timeframe:string;trained_at:string;validation_eligible:boolean;paper_eligible:boolean;validation_score:number|null;holdout_return_percent:number|null;holdout_drawdown_percent:number|null};
type Trial={trial_key:string;strategy:string;timeframe:string;status:string;claimed_at:string;completed_at:string|null;error_reason:string|null;validation_score:number|null;validation_eligible:boolean|null};
type Snapshot={training_count:number;latest_training_at:string|null;latest_models:Model[];candidate_counts:Record<string,number>;recent_candidates:Trial[];stale_claims:number};
const date=(s:string|null)=>s?new Date(s).toLocaleString('zh-TW',{hour12:false}):'尚無紀錄';
const num=(n:number|null)=>n===null||!Number.isFinite(n)?'—':n.toFixed(2);
export function TrainingMonitor(){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function refresh(){
    if(!supabase)return;
    setBusy(true);
    const {data,error:failure}=await supabase.rpc('get_ai_training_control_status');
    if(failure){setError('無法讀取訓練監控：'+failure.message);setSnapshot(null)}
    else {setSnapshot(data as Snapshot);setError('')}
    setBusy(false);
  }
  useEffect(()=>{void refresh()},[]);
  const counts=snapshot?.candidate_counts||{};
  const failed=(counts.FAILED||0)>0||((snapshot?.stale_claims||0)>0);
  return <div className="monitor">
    <div className="section-head"><div><h2>自主訓練監控</h2><p>Supabase 即時查詢 · 僅管理員可讀 · 不提供交易操作</p></div><button className="logout" disabled={busy} onClick={()=>void refresh()}>{busy?'查詢中…':'重新整理'}</button></div>
    {error&&<p className="monitor-error" role="alert">{error}</p>}
    {snapshot&&<>
      <div className="monitor-metrics">
        <div><small>累積訓練</small><strong>{snapshot.training_count.toLocaleString()} 筆</strong></div>
        <div><small>最近訓練</small><strong>{date(snapshot.latest_training_at)}</strong></div>
        <div><small>候選實驗</small><strong>{Object.values(counts).reduce((a,b)=>a+b,0)} 筆</strong></div>
        <div><small>實驗健康</small><strong>{failed?'需人工檢查':(counts.CLAIMED||0)>0?'執行中':'正常／無異常紀錄'}</strong></div>
      </div>
      <h3>最新模型資格</h3><div className="table-wrap"><table><thead><tr><th>策略</th><th>週期</th><th>Validation</th><th>Paper 資格</th><th>Holdout 報酬 %</th><th>Holdout 回撤 %</th></tr></thead><tbody>{snapshot.latest_models.map(m=><tr key={m.strategy}><td>{m.strategy}</td><td>{m.timeframe}</td><td>{m.validation_eligible?'通過':'未通過'}</td><td>{m.paper_eligible?'符合資格（未啟用）':'不符合'}</td><td>{num(m.holdout_return_percent)}</td><td>{num(m.holdout_drawdown_percent)}</td></tr>)}</tbody></table></div>
      <h3>候選實驗紀錄</h3><p className="monitor-hint">已申請：{counts.CLAIMED||0} · 已評估：{counts.VALIDATION_EVALUATED||0} · 未通過：{counts.VALIDATION_REJECTED||0} · 失敗：{counts.FAILED||0} · 逾時：{snapshot.stale_claims}</p>
      <div className="table-wrap"><table><thead><tr><th>策略</th><th>狀態</th><th>申請時間</th><th>完成時間</th><th>失敗原因</th></tr></thead><tbody>{snapshot.recent_candidates.length?snapshot.recent_candidates.map(t=><tr key={t.trial_key}><td>{t.strategy} / {t.timeframe}</td><td>{t.status}</td><td>{date(t.claimed_at)}</td><td>{date(t.completed_at)}</td><td>{t.error_reason||'—'}</td></tr>):<tr><td colSpan={5} className="empty-table">尚無候選實驗；不代表系統發生故障</td></tr>}</tbody></table></div>
      <p className="footnote">顯示的是歷史評估結果，並非實盤或即時交易訊號。模型不會因為此頁面自動啟用。</p>
    </>}
  </div>;
}
