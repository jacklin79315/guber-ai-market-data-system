// P2 deterministic spot trade execution, isolated from live orders.
export function resolveExit({high,low,close,stopLoss,takeProfit,side="LONG"}){
 const values=[high,low,close,stopLoss,takeProfit].map(Number);
 if(values.some(v=>!Number.isFinite(v)||v<=0))throw Error("invalid candle or exit level");
 if(Number(low)>Number(high)||Number(close)<Number(low)||Number(close)>Number(high))throw Error("invalid candle range");
 if(side!=="LONG"&&side!=="SHORT")throw Error("invalid side");
 const tp=side==="LONG"?Number(high)>=Number(takeProfit):Number(low)<=Number(takeProfit);
 const sl=side==="LONG"?Number(low)<=Number(stopLoss):Number(high)>=Number(stopLoss);
 if(tp&&sl){const dt=Math.abs(Number(close)-Number(takeProfit));const ds=Math.abs(Number(close)-Number(stopLoss));return {exit:"SL",price:Number(stopLoss),ambiguous:true,...(dt<ds?{exit:"TP",price:Number(takeProfit)}:{})}}
 if(tp)return {exit:"TP",price:Number(takeProfit),ambiguous:false};
 if(sl)return {exit:"SL",price:Number(stopLoss),ambiguous:false};
 return {exit:"HOLD",price:null,ambiguous:false};
}
export function spotNetReturn({entry,exit,feeRate=0.001,slippageRate=0}){
 for(const v of [entry,exit,feeRate,slippageRate])if(!Number.isFinite(v))throw Error("invalid input");
 if(entry<=0||exit<=0||feeRate<0||slippageRate<0||feeRate+slippageRate>=1)throw Error("invalid costs");
 const bought=entry*(1+slippageRate);
 const sold=exit*(1-slippageRate);
 return (sold*(1-feeRate))/(bought*(1+feeRate))-1;
}
