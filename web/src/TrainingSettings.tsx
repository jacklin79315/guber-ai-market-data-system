import {useEffect,useState} from 'react';
import {supabase} from './auth';
type Config={symbol:string;lookback_days:number};
const defaults:Config={symbol:'BTCUSDT',lookback_days:365};
export function TrainingSettings(){
 const [config,setConfig]=useState<Config>(defaults);
 const [status,setStatus]=useState('讀取中…');
 const [ready,setReady]=useState(false);
 const [saving,setSaving]=useState(false);
 useEffect(()=>{let alive=true;async function load(){
  if(!supabase){setStatus('Supabase 尚未設定');return}
  const {data,error}=await supabase.from('web_training_settings').select('config').eq('id',1).single();
  if(!alive)return;
  if(error){setStatus('尚無法讀取設定，請先建立設定資料表。');return}
  setConfig({...defaults,...(data.config as Partial<Config>)});setReady(true);setStatus('已載入設定');
 }void load();return()=>{alive=false}},[]);
 async function save(){
  if(!supabase||!ready)return;
  setSaving(true);
  const {error}=await supabase.from('web_training_settings').update({config,updated_at:new Date().toISOString()}).eq('id',1);
  setStatus(error?'儲存失敗，請檢查管理者權限。':'已儲存。訓練程式尚未接入此設定。');setSaving(false);
 }
 return <article className="panel section"><h2>訓練參數</h2><p>每次訓練會使用選定交易對及歷史年數；四個模型週期固定分別訓練。儲存不會立即啟動訓練。</p>
 <p><label>交易對 <select disabled={!ready} value={config.symbol} onChange={e=>setConfig(v=>({...v,symbol:e.target.value}))}><option>BTCUSDT</option><option>ETHUSDT</option></select></label></p>
 <p><label>資料天數 <input disabled={!ready} type="number" min={30} max={1825} value={config.lookback_days} onChange={e=>setConfig(v=>({...v,lookback_days:Number(e.target.value)}))}/></label></p>
 <button disabled={!ready||saving||![365,730,1095].includes(config.lookback_days)} onClick={()=>void save()}>{saving?'儲存中…':'儲存設定'}</button><p role="status">{status}</p></article>;
}
