// Strict read-only, decision-time feature reader backed by the verified market_features schema.
const fields=['source','market','symbol','timeframe','open_time','close_time','rsi_12','atr_percent','volume_ratio','adx_14','return_3'];
export function createSupabaseFeatureAtDecision({supabaseUrl,apiKey,fetchImpl=fetch,source='BINANCE',market='SPOT'}={}){
 if(typeof supabaseUrl!=='string'||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||typeof apiKey!=='string'||!apiKey||typeof fetchImpl!=='function')throw Error('invalid feature reader settings');
 const cache=new Map();
 return async ({candidate}={})=>{
  if(!candidate||typeof candidate.symbol!=='string'||typeof candidate.timeframe!=='string'||!Number.isSafeInteger(candidate.decisionTime))throw Error('invalid feature decision');
  const cacheKey=JSON.stringify([source,market,candidate.symbol,candidate.timeframe,candidate.decisionTime]);
  if(cache.has(cacheKey))return {...await cache.get(cacheKey)};
  const read=async()=>{
  const url=new URL('/rest/v1/market_features',supabaseUrl);
  for(const [k,v] of Object.entries({source,market,symbol:candidate.symbol,timeframe:candidate.timeframe,close_time:candidate.decisionTime}))url.searchParams.set(k,'eq.'+v);
  url.searchParams.set('select',fields.join(','));url.searchParams.set('limit','2');
  const response=await fetchImpl(url.toString(),{method:'GET',headers:{apikey:apiKey,Authorization:'Bearer '+apiKey,Accept:'application/json'}});
  if(!response.ok)throw Error('feature snapshot read failed: '+response.status);
  const rows=await response.json();if(!Array.isArray(rows)||rows.length!==1)throw Error('missing or ambiguous decision-time feature');
  const row=rows[0];if(row.source!==source||row.market!==market||row.symbol!==candidate.symbol||row.timeframe!==candidate.timeframe||Number(row.close_time)!==candidate.decisionTime||!Number.isSafeInteger(Number(row.open_time))||Number(row.open_time)>=candidate.decisionTime)throw Error('misaligned decision-time feature');
  const numeric=['rsi_12','atr_percent','volume_ratio','adx_14','return_3'];
  if(numeric.some(k=>row[k]===null||row[k]===undefined||row[k]===''||!Number.isFinite(Number(row[k]))))throw Error('incomplete decision-time feature');
  return {asOfMs:candidate.decisionTime,rsi:Number(row.rsi_12),atrPercent:Number(row.atr_percent),volumeRatio:Number(row.volume_ratio),trendStrength:Number(row.adx_14),momentum:Number(row.return_3)};
  };
  const pending=read();cache.set(cacheKey,pending);
  try{return {...await pending}}catch(e){cache.delete(cacheKey);throw e}
 };
}
