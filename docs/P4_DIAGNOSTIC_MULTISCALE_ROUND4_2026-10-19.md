# P4 第四輪多尺度歷史研究：已完成

GitHub Actions: https://github.com/jacklin79315/guber-ai-market-data-system/actions/runs/39163682247 (SUCCESS)
Supabase immutable summary: `p4_diag_entry_multiscale_20261019_01`, status `OOS_RESEARCH_EVALUATED`.
2000 BTCUSDT 1h candles, chronological 1300 training + 700 OOS, older disjoint historical window. Explored six candidates (steps 1,2,3); excluded previously failed lookback upward direction.
Train selected Entry lookback 20→17: champion 59 trades -50.565387 USDT, challenger 61 trades -44.399822 USDT; improvement +6.165565 USDT.
OOS: champion 47 trades +65.442656 USDT (fees 26.515252), challenger 51 trades +108.897835 USDT (fees 31.580650); improvement +43.455180 USDT. Both exceed minimum 30 closed trades.
`learningEvidence.assessment=PROMISING_REQUIRES_INDEPENDENT_VALIDATION`, `oosEvidenceStatus=OOS_IMPROVED_RESEARCH_ONLY`, `independentValidation=false`, `learnedModelUpdated=false`, `championPromotionAllowed=false`.
IMPORTANT: OOS is internal chronological held-out history, NOT a fresh independent forward period. Do not reuse this OOS for selection or claim model is profitable. Next: independent untouched evidence / prospective shadow paper evaluation with preregistered candidate and cost assumptions, then risk-expert review before any promotion. Never automated live orders.
