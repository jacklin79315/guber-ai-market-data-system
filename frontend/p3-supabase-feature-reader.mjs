// Strict read-only, decision-time feature reader backed by the verified market_features schema.
const fields=['source','market','symbol','timeframe','open_time','close_time','rsi_12','atr_percent','volume_ratio','adx_14','return_3'];
export function createSupabaseFeatureAtDecision({supabaseUrl,apiKey,fetchImpl=fetch,source='BINANCE',market='SPOT'}={}){
 if(typeof supabaseUrl!=='string'||!/^https:\/\/[^/]+\/?$/.test(supabaseUrl)||typeof apiKey!=='string'||!apiKey||typeof fetchImpl!=='function')throw Error('invalid feature reader settings');
 const cache=new Map();
 const numeric=['rsi_12','atr_percent','volume_ratio','adx_14','return_3'];
 const normalize=(row,candidate)=>{
  if(row.source!==source||row.market!==market||row.symbol!==candidate.symbol||row.timeframe!==candidate.timeframe||Number(row.close_time)!==candidate.decisionTime||!Number.isSafeInteger(Number(row.open_time))||Number(row.open_time)>=candidate.decisionTime)throw Error('misaligned decision-time feature');
  if(numeric.some(k=>row[k]===null||row[k]===undefined||row[k]===''||!Number.isFinite(Number(row[k]))))throw Error('incomplete decision-time feature');
  return {asOfMs:candidate.decisionTime,rsi:Number(row.rsi_12),atrPercent:Number(row.atr_percent),volumeRatio:Number(row.volume_ratio),trendStrength:Number(row.adx_14),momentum:Number(row.return_3)};
 };
 const headers={apikey:apiKey,Authorization:'Bearer '+apiKey,Accept:'application/json'};
 const prefetch=async ({symbol,timeframe,fromCloseTime,toCloseTime,pageSize=500,onPage}={})=>{
  if(typeof symbol!=='string'||!/^[A-Z0-9]{3,30}$/.test(symbol)||!['15m','1h','4h','1d'].includes(timeframe)||![fromCloseTime,toCloseTime].every(Number.isSafeInteger)||fromCloseTime>toCloseTime||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>1000)throw Error('invalid feature prefetch window');
  if(onPage!==undefined&&typeof onPage!=='function')throw Error('invalid feature prefetch progress callback');
  let loaded=0,previous=null;
  for(let offset=0;;offset+=pageSize){
   const url=new URL('/rest/v1/market_features',supabaseUrl);
   for(const [k,v] of Object.entries({source,market,symbol,timeframe}))url.searchParams.set(k,'eq.'+v);
   url.searchParams.set('close_time','gte.'+fromCloseTime);
   url.searchParams.set('and','(close_time.lte.'+toCloseTime+')');
   url.searchParams.set('select',fields.join(','));url.searchParams.set('order','close_time.asc');url.searchParams.set('limit',String(pageSize));url.searchParams.set('offset',String(offset));
   let response;
   for(let attempt=0;attempt<4;attempt++){
    try{
     response=await fetchImpl(url.toString(),{method:'GET',headers,signal:AbortSignal.timeout(20000)});
     if(response.ok)break;
     if(![429,502,503,504,520,521,522,523,524].includes(response.status)||attempt===3)throw Error('feature prefetch failed: '+response.status+' at offset '+offset);
    }catch(e){if(attempt===3||!(/fetch|timeout|abort|network/i.test(e.message)))throw e}
    await new Promise(resolve=>setTimeout(resolve,500*(2**attempt)));
   }
   const rows=await response.json();if(!Array.isArray(rows)||rows.length>pageSize)throw Error('invalid feature prefetch response');
   for(const row of rows){
    const close=Number(row.close_time),candidate={symbol,timeframe,decisionTime:close};
    if(!Number.isSafeInteger(close)||close<fromCloseTime||close>toCloseTime||previous!==null&&close<=previous)throw Error('unordered or duplicate feature snapshot');
    const value=normalize(row,candidate);
    cache.set(JSON.stringify([source,market,symbol,timeframe,close]),Promise.resolve(value));
    previous=close;loaded++;
   }
   await onPage?.({loaded,offset,received:rows.length});
   if(rows.length<pageSize)break;
  }
  return {loaded};
 };
 const reader=async ({candidate}={})=>{
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
  return normalize(row,candidate);
  };
  const pending=read();cache.set(cacheKey,pending);
  try{return {...await pending}}catch(e){cache.delete(cacheKey);throw e}
 };
 reader.prefetch=prefetch;
 return reader;
}
