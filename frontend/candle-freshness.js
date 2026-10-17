export const FRAME_MS=Object.freeze({"15m":900000,"1h":3600000,"4h":14400000,"1d":86400000});
export function assessCandleFreshness(closeTime,frame,now=Date.now()){
 const interval=FRAME_MS[frame];
 if(!interval)return {state:"時間異常",reason:"不支援的週期"};
 if(closeTime===null||closeTime===undefined||closeTime==="")return {state:"無資料",reason:"沒有已收盤資料"};
 const numeric=Number(closeTime);
 const timestamp=Number.isFinite(numeric)?numeric:Date.parse(closeTime);
 if(!Number.isFinite(timestamp)||timestamp<=0)return {state:"時間異常",reason:"收盤時間無效"};
 const age=now-timestamp;
 if(age < -1000)return {state:"時間異常",reason:"收盤時間位於未來"};
 if(age<=interval*2.5)return {state:"正常",timestamp,age};
 return {state:"可能延遲",timestamp,age};
}
