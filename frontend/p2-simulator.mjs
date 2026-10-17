// P2 deterministic simulation core. No live orders or external side effects.
// All amounts are in the configured simulation account unit.
export function createAccount({initialCapital=10000,maxUtilization=0.8}={}){
 if(!Number.isFinite(initialCapital)||initialCapital<=0||!Number.isFinite(maxUtilization)||maxUtilization<=0||maxUtilization>0.8)throw Error("invalid account settings");
 return {initialCapital,cash:initialCapital,equity:initialCapital,maxUtilization,positions:[],pending:[],closed:[],cancelled:[],shadowOrders:[]};
}
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const touches=(bar,range)=>bar.low<=range[1]&&bar.high>=range[0];
const overlaps=(a,b)=>a[0]<=b[1]&&b[0]<=a[1];
function validateProposal(p){
 if(!p||!["LONG","SHORT"].includes(p.side)||!p.symbol||!p.timeframe||!Number.isInteger(p.decisionIndex)||p.decisionIndex<0)throw Error("invalid proposal");
 for(const key of ["entry","takeProfit","stopLoss"]){if(!Array.isArray(p[key])||p[key].length!==2||!p[key].every(finite)||p[key][0]<=0||p[key][0]>p[key][1])throw Error("invalid "+key)}
 if(!finite(p.capital)||p.capital<=0)throw Error("invalid capital");
 if(p.side==="LONG"&&!(p.stopLoss[1]<p.entry[0]&&p.takeProfit[0]>p.entry[1]))throw Error("invalid LONG levels");
 if(p.side==="SHORT"&&!(p.takeProfit[1]<p.entry[0]&&p.stopLoss[0]>p.entry[1]))throw Error("invalid SHORT levels");
}
export function submitProposal(account,p){
 validateProposal(p);
 if([...account.pending,...account.positions].some(x=>x.symbol===p.symbol&&x.timeframe===p.timeframe&&overlaps(x.entry,p.entry)))return {accepted:false,reason:"OVERLAPPING_ENTRY"};
 if(account.pending.some(x=>x.id===p.id)||account.positions.some(x=>x.id===p.id)||account.closed.some(x=>x.id===p.id)||account.cancelled.some(x=>x.id===p.id))return {accepted:false,reason:"DUPLICATE_ID"};
 account.pending.push({...p,entry:[...p.entry],takeProfit:[...p.takeProfit],stopLoss:[...p.stopLoss],state:"PENDING"});return {accepted:true};
}
function decideExit(p,bar){
 const tp=touches(bar,p.takeProfit),sl=touches(bar,p.stopLoss)||(p.state==="OPEN"&&(p.side==="LONG"?bar.open<p.stopLoss[0]:bar.open>p.stopLoss[1]));
 if(!tp&&!sl)return null;
 if(tp&&sl){const tpDistance=Math.min(...p.takeProfit.map(x=>Math.abs(bar.close-x)));const slDistance=Math.min(...p.stopLoss.map(x=>Math.abs(bar.close-x)));return tpDistance<slDistance?"TP":"SL"}
 return tp?"TP":"SL";
}
function occupied(account){return account.positions.reduce((sum,p)=>sum+p.capital,0)}
function refreshEquity(account){account.equity=account.cash+account.positions.reduce((sum,p)=>sum+p.capital+(p.side==="LONG"?1:-1)*(p.markPrice-p.entryPrice)*(p.capital/p.entryPrice),0)}
export function processBar(account,bar,index,{feeRate,slippageRate}={}){
 if(!Number.isInteger(index)||index<0||!bar||!["open","high","low","close"].every(k=>finite(bar[k]))||bar.low>bar.high||bar.open<bar.low||bar.open>bar.high||bar.close<bar.low||bar.close>bar.high)throw Error("invalid bar");
 // Costs and fill pricing are deliberately required, not silently assumed.
 if(!finite(feeRate)||feeRate<0||!finite(slippageRate)||slippageRate<0||slippageRate>=1)throw Error("explicit costs required");
 const events=[];
 // Preserve subsequent closed candles for cancelled proposals; no hindsight fills.
 for(const shadow of account.shadowOrders){
  const p=shadow.proposal;
  if(p.symbol===bar.symbol&&p.timeframe===bar.timeframe&&index>shadow.cancelIndex){
   const observation={index,open:bar.open,high:bar.high,low:bar.low,close:bar.close,entryTouched:touches(bar,p.entry),tpTouched:touches(bar,p.takeProfit),slTouched:touches(bar,p.stopLoss)};
   observation.touchedLevels=["entry","tp","sl"].filter(k=>observation[k+"Touched"]);
   observation.ambiguousSequence=observation.touchedLevels.length>1;
   shadow.observations.push(observation);
   shadow.ambiguousBars??=[];
   if(observation.ambiguousSequence)shadow.ambiguousBars.push(index);
   shadow.firstTouches??={entry:null,tp:null,sl:null};
   for(const [key,hit] of [["entry",observation.entryTouched],["tp",observation.tpTouched],["sl",observation.slTouched]]){
    if(hit&&shadow.firstTouches[key]===null)shadow.firstTouches[key]=index;
   }
   const first=shadow.firstTouches;
   shadow.counterfactualStatus=shadow.ambiguousBars.length?"AMBIGUOUS_SEQUENCE":first.entry===null?"ENTRY_NOT_REVISITED":first.tp!==null||first.sl!==null?"LEVELS_OBSERVED":"ENTRY_REVISITED";
   shadow.counterfactualOutcome="UNDETERMINED";
   shadow.hypotheticalPnl=null;
   // Classifications are evidence states, not counterfactual profit claims.
  }
 }
 for(const p of account.positions){if(p.symbol===bar.symbol&&p.timeframe===bar.timeframe)p.markPrice=bar.close}
 refreshEquity(account);
 for(const p of [...account.positions]){
  if(p.symbol!==bar.symbol||p.timeframe!==bar.timeframe||index<=p.entryIndex)continue;
  const exit=decideExit(p,bar);if(!exit)continue;
  const target=exit==="TP"?(p.side==="LONG"?p.takeProfit[0]:p.takeProfit[1]):(p.side==="LONG"?p.stopLoss[0]:p.stopLoss[1]);
  // A stop crossed by an opening gap fills no better than the adverse open.
  const gapStop=exit==="SL"?(p.side==="LONG"?Math.min(target,bar.open):Math.max(target,bar.open)):target;
  const exitPrice=gapStop*(p.side==="LONG"?1-slippageRate:1+slippageRate);
  const qty=p.capital/p.entryPrice;
  const pnl=(p.side==="LONG"?1:-1)*(exitPrice-p.entryPrice)*qty;
  const exitFee=exitPrice*qty*feeRate;
  account.cash+=p.capital+pnl-exitFee;
  const record={...p,state:"CLOSED",exitIndex:index,exitReason:exit,exitPrice,pnl:pnl-p.entryFee-exitFee};
  account.positions.splice(account.positions.indexOf(p),1);account.closed.push(record);refreshEquity(account);events.push({id:p.id,type:"CLOSED",reason:exit});
 }
 for(const p of [...account.pending]){
  if(p.symbol!==bar.symbol||p.timeframe!==bar.timeframe||index<=p.decisionIndex)continue;
  const entryHit=touches(bar,p.entry),exit=decideExit(p,bar);
  // Ambiguous intrabar order is not inferred from OHLC. No entry if TP/SL also touched.
  if(exit){account.pending.splice(account.pending.indexOf(p),1);account.cancelled.push({...p,state:"CANCELLED",cancelIndex:index,cancelReason:entryHit?"AMBIGUOUS_BAR":"PRE_ENTRY_"+exit});account.shadowOrders.push({proposal:{...p},cancelIndex:index,reason:entryHit?"AMBIGUOUS_BAR":"PRE_ENTRY_"+exit,realizedPnl:0,observations:[]});events.push({id:p.id,type:"CANCELLED",reason:entryHit?"AMBIGUOUS_BAR":"PRE_ENTRY_"+exit});continue}
  if(!entryHit)continue;
  const used=occupied(account);
  if(account.equity<=0||used+p.capital>account.equity*account.maxUtilization||p.capital>account.cash){events.push({id:p.id,type:"WAIT_CAPITAL"});continue}
  // Fill only within the actual traded intersection of bar and entry range.
  const basePrice=p.side==="LONG"?Math.min(p.entry[1],bar.high):Math.max(p.entry[0],bar.low);
  const entryPrice=basePrice*(p.side==="LONG"?1+slippageRate:1-slippageRate);
  const entryFee=p.capital*feeRate;
  if(p.capital+entryFee>account.cash){events.push({id:p.id,type:"WAIT_CAPITAL"});continue}
  account.cash-=p.capital+entryFee;
  account.pending.splice(account.pending.indexOf(p),1);
  account.positions.push({...p,state:"OPEN",entryIndex:index,entryPrice,entryFee,markPrice:bar.close});refreshEquity(account);events.push({id:p.id,type:"OPEN"});
 }
 refreshEquity(account);
 return events;
}
