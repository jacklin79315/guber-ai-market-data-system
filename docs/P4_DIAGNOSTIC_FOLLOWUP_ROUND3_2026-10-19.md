# P4 第三輪診斷後續研究：實際結果

- GitHub Actions https://github.com/jacklin79315/guber-ai-market-data-system/actions/runs/39162095306 ：SUCCESS
- Supabase 任務 `p4_followup_entry_20261019_01`：COMPLETED；resultJobId=`p4_diag_entry_followup_20261019_01`。
- 來源研究 `p4_diag_entry_priorwindow_35pct_20261019_01`，失敗方向 `entryLookback 20 → 21`；新研究實際排除這個方向。
- 第三輪為更早且與來源研究不重疊的歷史 2000 根 BTCUSDT 1h；訓練 1300 / OOS 保留 700。
- 訓練 Champion 68 trades，net PNL -90.228113 USDT。
- Challenger `entryLookback 20 → 19`：68 trades，net PNL -90.228113 USDT，差 0。
- Challenger `entryThreshold 0.001 → 0.0009`：69 trades，net PNL -104.380223 USDT，差 -14.152109。
- 因為訓練候選均未改善，`NO_TRAIN_SELECTED_ARM`；`oosEvidenceStatus=NOT_EVALUATED`，沒有 OOS 交易數或 OOS 損益，**不可把此輪稱為 OOS 驗證成功**。
- `nextResearchAction=COLLECT_MORE_TRAIN_EVIDENCE`。沒有更新模型、沒有升級 Champion、沒有真實下單。
- 結論：完成一次真正的「持久化診斷 → 排除失敗方向 → 新窗口歷史回放 → 持久化結果」閉環；但尚無獲利能力提升證據，且樣本仍有限。下一輪應擴展獨立訓練證據及研究候選覆蓋，而非反覆重測同一窗口以尋找好看的結果。
