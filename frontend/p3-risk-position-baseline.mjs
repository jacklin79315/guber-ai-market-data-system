import {applyExpertPatch} from './p3-contract.mjs';
// Research-only Risk/Position baseline. All capital amounts share one simulated account.
export function estimateRiskPositionBaseline({proposal,account,maxPortfolioUtilization=0.8,maxTradeFraction=0.1,maxLossFraction=0.01}={}){
 if(!proposal||!(proposal.expectedValue===null||Number.isFinite(proposal.expectedValue))||!Number.isFinite(proposal.expectedLoss)||proposal.expectedLoss<=0||!account||![account.equity,account.committedCapital].every(v=>Number.isFinite(v)&&v>=0)||!Number.isFinite(account.equity)||account.equity<=0||![maxPortfolioUtilization,maxTradeFraction,maxLossFraction].every(v=>Number.isFinite(v)&&v>0&&v<=1)||maxPortfolioUtilization>0.8)throw Error('invalid risk settings');
 if(account.committedCapital>account.equity+1e-8)throw Error('invalid committed capital');
 if(proposal.expectedValue!==null&&proposal.expectedValue<=0)return {action:'WAIT',reason:'NON_POSITIVE_EXPECTANCY'};
 const available=Math.max(0,Math.min(account.equity-account.committedCapital,account.equity*maxPortfolioUtilization-account.committedCapital));
 const allocation=Math.min(available,account.equity*maxTradeFraction*(proposal.expectedValue===null?0.25:1),account.equity*maxLossFraction/proposal.expectedLoss);
 if(!Number.isFinite(allocation)||allocation<=0)return {action:'WAIT',reason:'INSUFFICIENT_ACCOUNT_CAPACITY'};
 return {action:'CONTINUE',patch:{allocation,riskReason:'Single simulation account: portfolio cap '+maxPortfolioUtilization+', trade cap '+maxTradeFraction+', estimated loss budget '+maxLossFraction+' of equity; committed capital '+account.committedCapital+'; expected net loss fraction '+proposal.expectedLoss+'; '+(proposal.expectedValue===null?'UNKNOWN probability: provisional 25% of trade cap, unvalidated':'estimated positive EV')},availableCapital:available,projectedUtilization:(account.committedCapital+allocation)/account.equity};
}
export function applyRiskPositionBaseline({proposal,account,...options}={}){
 const result=estimateRiskPositionBaseline({proposal,account,...options});
 if(result.action==='WAIT')return result;
 return {...result,proposal:applyExpertPatch('riskPosition',proposal,result.patch)};
}
