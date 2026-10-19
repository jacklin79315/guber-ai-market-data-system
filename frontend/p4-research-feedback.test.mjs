import test from 'node:test';
import assert from 'node:assert/strict';
import {assessP4ResearchFeedback} from './p4-research-feedback.mjs';
const sample=(version,closedTrades,netRealizedPnl)=>({version,processedCandles:500,metrics:{closedTrades,netRealizedPnl,realizedReturn:netRealizedPnl/10000,totalFees:3,costLedgerComplete:true}});
const comparison=(a,b)=>({status:'RESEARCH_COMPARISON_ONLY',independentValidation:false,promotionAllowed:false,champion:a,challenger:b});
test('P4 feedback rejects insufficient trade samples even when challenger wins',()=>{const r=assessP4ResearchFeedback({comparison:comparison(sample('champion',7,1),sample('challenger',7,10))});assert.equal(r.status,'INSUFFICIENT_RESEARCH_SAMPLES');assert.equal(r.proposedNextResearchParent,'champion');assert.equal(r.promotionAllowed,false)});
test('P4 feedback may nominate research parent but never promote Champion',()=>{const r=assessP4ResearchFeedback({comparison:comparison(sample('champion',35,1),sample('challenger',35,10))});assert.equal(r.proposedNextResearchParent,'challenger');assert.equal(r.independentValidation,false);assert.equal(r.promotionAllowed,false)});
test('P4 feedback rejects missing cost reconciliation',()=>{const b=sample('challenger',35,10);b.metrics.costLedgerComplete=false;assert.throws(()=>assessP4ResearchFeedback({comparison:comparison(sample('champion',35,1),b)}),/incomplete P4 cost/)});
test('P4 feedback rejects invalid independent validation claims',()=>{const c=comparison(sample('champion',35,1),sample('challenger',35,10));c.independentValidation=true;assert.throws(()=>assessP4ResearchFeedback({comparison:c}),/invalid P4/)});

test('diagnosed challenger Risk fault blocks advancing research parent despite higher net PnL',()=>{
 const c=comparison(sample('champion',35,1),sample('challenger',35,10));
 c.diagnosticAudit={challenger:{actors:{Risk:{negative:2}}}};
 const r=assessP4ResearchFeedback({comparison:c});
 assert.equal(r.blockedByDiagnosticRisk,true);
 assert.equal(r.improvedInSameWindow,false);
 assert.equal(r.proposedNextResearchParent,'champion');
 assert.equal(r.promotionAllowed,false);
});
