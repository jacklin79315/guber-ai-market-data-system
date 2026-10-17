// Server-side inference transport only. No credentials are exposed in responses.
export function createInferenceTransport({endpoint,token,fetchImpl=fetch,timeoutMs=10000}={}){
 if(typeof endpoint!=='string'||!endpoint||typeof token!=='string'||!token||typeof fetchImpl!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>60000)throw Error('inference transport not configured');
 let url;try{url=new URL(endpoint)}catch{throw Error('invalid inference endpoint')}
 if(url.protocol!=='https:'||url.username||url.password||url.hash)throw Error('inference endpoint must be HTTPS');
 return async request=>{
  if(!request||typeof request!=='object'||typeof request.expert!=='string'||typeof request.modelVersion!=='string')throw Error('invalid inference request');
  let response;
  try{response=await fetchImpl(url.toString(),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(timeoutMs)})}
  catch{throw Error('inference transport unavailable')}
  if(!response.ok)throw Error('inference service rejected request: '+response.status);
  const length=Number(response.headers?.get?.('content-length')||0);
  if(length>65536)throw Error('inference response too large');
  let raw;try{raw=await response.text()}catch{throw Error('inference response unreadable')}
  if(raw.length>65536)throw Error('inference response too large');
  let result;try{result=JSON.parse(raw)}catch{throw Error('invalid inference JSON')}
  if(!result||typeof result!=='object'||Array.isArray(result))throw Error('invalid inference payload');
  return result;
 };
}
