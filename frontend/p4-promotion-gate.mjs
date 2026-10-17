// P4 research-only promotion guard. No training, deployment, or live trading occurs here.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function assessChallengerPromotion({champion,challenger,validation}={}){
 if(!champion||!challenger||typeof champion.version!=='string'||!champion.version||typeof challenger.version!=='string'||!challenger.version||champion.version===challenger.version||!validation||!Array.isArray(validation.windows)||validation.windows.length<1)throw Error('invalid promotion comparison');
 if(validation.sameData!==true||validation.sameCosts!==true||validation.sameCapital!==true||validation.sameExpertVersions!==true)return {action:'KEEP_CHAMPION',reason:'COMPARISON_NOT_CONTROLLED',championVersion:champion.version,challengerVersion:challenger.version};
 const windows=validation.windows;
 if(windows.some(w=>!w||w.independent!==true||w.usedForTuning!==false||!Number.isSafeInteger(w.startMs)||!Number.isSafeInteger(w.endMs)||w.startMs>=w.endMs||!finite(w.championNetReturn)||!finite(w.challengerNetReturn)||!finite(w.championMaxDrawdown)||!finite(w.challengerMaxDrawdown)||w.championMaxDrawdown<0||w.challengerMaxDrawdown<0||!Number.isSafeInteger(w.championClosedTrades)||!Number.isSafeInteger(w.challengerClosedTrades)||w.championClosedTrades<0||w.challengerClosedTrades<0))throw Error('invalid independent validation window');
 const sorted=[...windows].sort((a,b)=>a.startMs-b.startMs);
 if(sorted.some((w,i)=>i>0&&w.startMs<sorted[i-1].endMs))throw Error('overlapping independent validation windows');
 if(windows.some(w=>w.championClosedTrades===0||w.challengerClosedTrades===0))return {action:'KEEP_CHAMPION',reason:'NO_REALIZED_VALIDATION_TRADES',championVersion:champion.version,challengerVersion:challenger.version};
 if(windows.some(w=>w.challengerNetReturn<=w.championNetReturn||w.challengerMaxDrawdown>w.championMaxDrawdown))return {action:'KEEP_CHAMPION',reason:'NO_CONSISTENT_RISK_ADJUSTED_IMPROVEMENT',championVersion:champion.version,challengerVersion:challenger.version};
 return {action:'ELIGIBLE_FOR_REVIEW',reason:'INDEPENDENT_WINDOWS_IMPROVED_REQUIRES_FULL_TEAM_REVIEW',championVersion:champion.version,challengerVersion:challenger.version,validatedWindows:windows.length};
}
