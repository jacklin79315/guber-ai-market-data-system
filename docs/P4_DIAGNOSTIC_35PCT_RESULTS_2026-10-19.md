# P4 Entry 診斷研究：35% OOS 真實執行結果

## 實際執行
- GitHub Actions: https://github.com/jacklin79315/guber-ai-market-data-system/actions/runs/39161487646
- Result: SUCCESS；Supabase `public.p4_diagnostic_research_summaries` 已有 `p4_diag_entry_priorwindow_35pct_20261019_01`。
- BTCUSDT 1h，2000 根；train 1300 / OOS 700。
- 研究資料沿用上一輪同一段歷史資料，**只改變切分比例**；因此不能宣稱新的獨立 OOS 驗證。

## Supabase 研究證據
- Entry `entryLookback`：20 → 21。
- 訓練期淨損益差：+0.269113 USDT；trainImproved=true。
- OOS Champion / Challenger：各 38 筆已結算交易，均超過 30 筆最低門檻。
- OOS Champion / Challenger 淨損益：均為 -39.611358 USDT；差異 0 USDT。
- `learningEvidence.assessment=NO_OOS_IMPROVEMENT`，`oosSufficient=true`。
- `followUpPlan.action=REVISE_HYPOTHESIS`；避免再嘗試 `entryLookback` 20 → 21 的相同方向。
- `learnedModelUpdated=false`、`independentValidation=false`、`championPromotionAllowed=false`、`ordersEnabled=false`。

## 解釋及下一步
這證實研究管線能依真實回放結果，拒絕無改善的參數方向；**不是已驗證自主學習能提高獲利**。OOS 的 38 筆交易僅跨過最低樣本數門檻，不代表統計顯著性或跨市場穩健性。研究中的原參數與挑戰者在此窗口都虧損。

下一輪應：
1. 以持久化的失敗方向假設為輸入，生成排除 20 → 21 的新研究候選；先驗證候選與 lineage 正確。
2. 使用不同且未用於挑選假設的時間段，重新執行 research-only 訓練／OOS；避免在本窗口反覆調整。
3. 在真正未見資料上獨立驗證之前，禁止任何正式模型更新、Champion promotion 或自動下單。
