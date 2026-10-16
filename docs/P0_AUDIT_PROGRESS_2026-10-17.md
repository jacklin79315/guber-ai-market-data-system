# P0 驗收進度紀錄（2026-10-17）

狀態：**未完成驗收**。此檔只記錄已取得的證據與待處理項目，不修改資料或部署。

## P0.1 資料庫結構與安全
- public 5 表、ai_v2 20 表；均已啟用 RLS。
- Security Advisor：23 張表無 RLS policy（可能為預期的預設拒絕，須核對前端授權）；3 個 public SECURITY DEFINER RPC 可由 authenticated 執行；Auth leaked-password protection 未啟用。
- Performance Advisor：28 個外鍵缺乏覆蓋索引。需按實際查詢負載判斷，非立即全數新增。
- 待辦：RPC 授權與內容審核、角色矩陣、80% 資金限制與模型啟用限制的實際測試。

## P0.2 原始行情
- watchlist：BTCUSDT、ETHUSDT、SOLUSDT、BNBUSDT、XRPUSDT、DOGEUSDT、PENGUUSDT，均啟用 15m/1h/4h/1d、lookback_years=3。
- raw_candles 約 920,595 筆，數量持續變動。
- collector.py 使用原生 Binance 週期，依 close_time < now 排除未收盤根；無 5m 聚合。
- 待辦：28 組逐一驗證時間範圍、缺漏、重複、OHLC 邏輯與收盤時間。部分彙總 SQL 受到工具安全檢查阻擋，**尚無有效的全組驗收結果**。

## P0.3 技術指標
- feature_engine.py 已實作特徵計算；Procfile 指向 python worker.py；worker.py 在近期同步與回補後呼叫 feature_engine.sync()。
- feature_repair.py 可獨立修復，沒有獨立 Railway 定時服務。
- market_features 約 914,995 筆。
- 待辦：驗證 200 根暖機、1000 根遞迴窗口、各指標重算一致性與最新資料對齊。

## P0.4 排程與回補
- Railway production 的 native-candle-collector：ONLINE、1/1 replicas，最近部署 SUCCESS，無 Railway cron；collector.py 內部循環安排每 15 分鐘同步與台北時間每日 09:00 後深度回補。
- 最新 ingestion_jobs 顯示多組 SUCCEEDED，包含 DOGE、XRP、PENGU 等。
- 8 筆 FAILED 為早期 api.binance.com HTTP 451 紀錄，不應直接視為當前故障。
- **16 筆 RUNNING 已超過 2 小時**，需查明是否中斷後殘留，並改善任務生命週期；未擅自清理。
- 待辦：核對 RUNNING、補全成功率、每日回補耗時、最新指標落後情況。

## 結論
P0.1～P0.4 均為**部分通過**，P0 尚不可封版。保留原始行情與指標資料，不修改排程、服務、資料庫表或任務紀錄。
