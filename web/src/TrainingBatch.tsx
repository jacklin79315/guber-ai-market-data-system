import React,{useEffect,useState} from 'react';
import {supabase} from './auth';
type Trial={strategy:string;trial_index:number;validation_score:number|null;validation_return_percent:number|null;validation_drawdown_percent:number|null;validation_trades:number|null;params:{max_iter:number;learning_rate:number}};
type Batch={run_id:string|null;total:number;completed:number;failed:number;running:number;ranking:Trial[]};
const fmt=(n:number|null)=>n===null?'—':Number(n).toFixed(2);
export function TrainingBatch(){
 const [data,setData]=useState<Batch|null>(null);
 const [error,setError]=useState('');
 const autonomous=!!data?.run_id?.startsWith('autonomous-v1-');
 async function refresh(){
  if(!supabase)return;
  const result=await supabase.rpc('get_ai_training_batch_status');
  if(result.error){setError(result.error.message);return;}
  setError('');setData(result.data as Batch);
 }
 useEffect(()=>{void refresh();},[]);
 return <section className="batch-monitor">
  <div className="section-head"><div><h2>模型訓練紀錄</h2><p>{autonomous?'自主迭代驗證評分（非報酬率）':'歷史批次驗證績效'} · Supabase 實際紀錄</p></div><button className="logout" onClick={()=>void refresh()}>更新結果</button></div>
  {error&&<p role="alert">{error}</p>}
  {data&&<><p>批次：{data.run_id||'尚未產生'} · 已完成 {data.completed}/{data.total} · 執行中 {data.running} · 失敗 {data.failed}</p>
  <div className="table-wrap"><table><thead><tr><th>排名</th><th>策略</th><th>實驗</th><th>驗證分數</th><th>{autonomous?'報酬（未計算）':'報酬 %'}</th><th>{autonomous?'回撤（未計算）':'回撤 %'}</th><th>交易次數</th><th>參數</th></tr></thead><tbody>
  {data.ranking.length?data.ranking.map((t,i)=><tr key={t.strategy+'-'+t.trial_index}><td>{i+1}</td><td>{t.strategy}</td><td>#{t.trial_index}</td><td>{fmt(t.validation_score)}</td><td>{fmt(t.validation_return_percent)}</td><td>{fmt(t.validation_drawdown_percent)}</td><td>{t.validation_trades??'—'}</td><td>{t.params.max_iter} / {t.params.learning_rate}</td></tr>):<tr><td colSpan={8}>尚無通過驗證條件的候選模型</td></tr>}
  </tbody></table></div><p className="footnote">此表僅供研究比較，自主迭代分數是方向機率的驗證評分，不能當成交易報酬；排名不代表樣本外獲利能力；模型不會自動晉級或下單。</p></>}
 </section>;
}
