# 歷史回補與指標恢復操作手冊（2026-10-17）

## 已新增程式
- collector.py: 新增 completed_initial()，查詢 ingestion_jobs 中在 watchlist.backfill_requested_at 之後成功完成的 INITIAL_BACKFILL；服務重啟時跳過已成功的商品/週期，保留尚未完成項目的重新執行。
- feature_repair.py: 可獨立執行 `python feature_repair.py` 或 `python feature_repair.py SOLUSDT`。讀取 watchlist，逐商品逐週期執行 feature_engine.sync()；不修改 raw_candles。
- worker.py 原有功能不變：原始資料回補/近期同步完成後觸發 feature_engine.sync()。

## 注意
1. 上述 GitHub commit **不代表已在 Railway 生效**；必須確認部署版本與實際執行結果。
2. feature_repair.py 是可獨立啟動的恢復指令，**目前尚未新增獨立 Railway 定時服務**；在驗證執行耗時、記憶體及並行寫入安全前，不應宣稱已自動定期修復。
3. collector.py 依 ingestion_jobs 的 SUCCEEDED 判斷完成，這是「逐商品/週期重啟續跑」，不是「同一週期逐分頁斷點續傳」；若中途失敗仍會重新掃描該週期，靠資料庫去重。
4. 資料回補完整性應以 raw_candles、market_features、ingestion_jobs 和 data_quality_issues 實際驗收，不只看服務 online。
5. 修復前先查 7 商品 × 4 週期的原始與指標筆數，執行後再查同一指標，確定資料增加且無錯誤。
6. 如果遇到容器頻繁重啟，先查 Railway runtime logs 與資源限制；大量技術指標計算不可在原因不明時無限制並行啟動。
