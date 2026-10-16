# AI 交易系統 V2 — 專案進度與交接快照
時間：2026-10-17（台北）
參考： [完整規劃](V2_MASTER_PLAN_2026-10-17.md) · [資料庫清冊](V2_DATABASE_INVENTORY_2026-10-17.md) · [架構契約](V2_ARCHITECTURE.md) · [研究表 SQL](../sql/v2_research_schema.sql)

## 現況
- GitHub main：Procfile、collector.py、feature_engine.py、worker.py、requirements.txt、docs/V2_ARCHITECTURE.md、sql/v2_research_schema.sql；此快照另新增 docs 規劃文件。
- 先前四個備份/feature 分支已查詢確認刪除，只剩 main。**Git 歷史未重寫**。
- Railway production：僅 native-candle-collector；最近檢查狀態 online，1/1 replica、0 crashed、0 active warning、0 recent deployment failures。
- 舊 training-control-web 已刪；**前端目前不存在**。
- Supabase public 五表，ai_v2 六表。ai_v2 已建立但沒有真正 AI 引擎程式。
- market_data_watchlist 七商品已啟用、各四個原生週期、lookback_years=3。
- 上次查詢：BTC raw 139450 / feature 138650；ETH raw 139451 / feature 138651；其他五商品 raw/feature 皆 0。這是**查詢當時的快照**，不是持續狀態。
- Railway 最近日誌有 BTC/ETH INITIAL_BACKFILL 及 features 更新紀錄；**尚未確認 SOL/BNB/XRP/DOGE/PENGU 完成任何回補**。日誌 INFO 訊息在 Railway 被標成 severity=error，不應只依 severity 推定工作失敗；應查實際內容與資料表。
- 既有收集器依 watchlist 自動執行 INITIAL_BACKFILL；新增 watchlist 可能已使背景服務開始工作，**不能把未經證實的情況寫成「已暫停」或「尚未開始」**。

## 五階段狀態
| 階段 | 子項 | 狀態 |
|---|---|---|
| 1 市場資料與前端 | BTC/ETH 原始及指標 | 已有資料，仍需品質驗收 |
| 1 市場資料與前端 | 五新增商品 watchlist | 已寫入、已啟用 |
| 1 市場資料與前端 | 五新增商品歷史回補 | 尚未驗證成功 |
| 1 市場資料與前端 | 七商品四週期完整性 | 未驗收 |
| 1 市場資料與前端 | 前端重建及部署 | 尚未開始 |
| 2 模擬引擎 | ai_v2 六表 | 已建立；RLS 已啟用 |
| 2 模擬引擎 | Python 撮合/結算/測試 | 尚未開始 |
| 3 專家與大腦 | 五專家、Brain、WAIT | 尚未開始 |
| 4 診斷與迭代 | 診斷 AI、24 個月迭代、champion/challenger | 尚未開始 |
| 5 訓練監控 | AI 訓練前端、績效/版本 | 尚未開始 |

## 本次使用者要求的執行閘門
1. 先在 GitHub 備份完整規劃書、資料表、階段、進度。
2. 核對目標與需求，尤其第一階段**必須包含前端**。
3. 再啟動/確認五新增商品歷史回補並監控 raw + features 實際寫入。
4. 不因為 ai_v2 schema 已存在就跳到 Phase 2。
5. 任何不確定/未查證事項都標記清楚。

## 下次接手第一個動作
1. 讀上述四份文件，核對當前 main、Railway 和 Supabase 實際狀態。
2. 查七商品 × 四週期 raw/feature 的 count、min/max timestamp、缺漏、品質異常、ingestion_jobs；確認新商品是否已由背景 collector 自動開始。
3. 檢查收集器回補順序/效能，避免多次重啟引發全量重跑；必要時才提出最小修改。
4. 重建安全的前端管理服務並部署，驗收資料完整後才轉 Phase 2。

## 避免重犯的錯誤
- 不把「已加入 watchlist」說成「回補完成」。
- 不把「資料表已建立」說成「模擬引擎完成」。
- 不把「Railway online」說成「七商品資料皆正常」。
- 不遺漏前端，也不等到 Phase 5 才開始製作。
- 不擅自加入自動實盤下單或舊 0–100 評分制度。
