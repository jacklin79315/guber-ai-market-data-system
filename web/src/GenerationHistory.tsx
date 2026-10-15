import React,{useEffect,useState} from 'react';
import {supabase} from './auth';

type HistoryRow={
 run_id:string;parent_run_id:string|null;symbol:string;strategy:string;
 generation:number;status:string;reason:string|null;created_at:string;
 comparison:{score_delta?:number;research_promoted?:boolean;
  champion_params?:Record<string,number>;challenger_params?:Record<string,number>};
};

export function GenerationHistory(){
 const [rows,setRows]=useState<HistoryRow[]>([]);
 const [error,setError]=useState('');
 async function refresh(){
  if(!supabase)return;
  const result=await supabase.rpc('get_ai_training_generation_history');
  if(result.error){setError(result.error.message);return;}
  setError('');setRows((result.data||[]) as HistoryRow[]);
 }
 useEffect(()=>{void refresh();},[]);
 return <section className="batch-monitor">
  <div className="section-head"><div><h2>模型世代進化紀錄</h2>
   <p>新舊模型同區間研究比較 · 不代表實盤績效</p></div>
   <button className="logout" onClick={()=>void refresh()}>更新世代紀錄</button></div>
  {error&&<p role="alert">{error}</p>}
  <div className="table-wrap"><table><thead><tr>
   <th>世代</th><th>策略</th><th>比較狀態</th><th>分數差異</th>
   <th>研究候選</th><th>原因</th><th>執行編號</th>
  </tr></thead><tbody>
  {rows.length?rows.map(r=><tr key={r.run_id+'-'+r.strategy}>
   <td>{r.generation}</td><td>{r.strategy}</td><td>{r.status}</td>
   <td>{typeof r.comparison?.score_delta==='number'?r.comparison.score_delta.toFixed(2):'—'}</td>
   <td>{r.comparison?.research_promoted?'通過研究門檻':'否'}</td>
   <td>{r.reason||'—'}</td>
   <td>{r.run_id}</td>
  </tr>):<tr><td colSpan={7}>尚無世代比較紀錄；第二代尚未完成</td></tr>}
  </tbody></table></div>
  <p className="footnote">不同時段的驗證績效不可直接比較。研究候選不會自動啟用模擬或實盤交易。</p>
 </section>;
}
