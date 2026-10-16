# P0 驗收進度紀錄（2026-10-17）

狀態：**已依使用者 2026-10-17 最新決定接受驗收並封版（P0 完成）**。以下早期未完成記錄保留作為歷史證據，不代表目前仍阻擋進入 P1；未測項目不冒稱技術驗證通過。

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


## 2026-10-17 追加驗收與處理結果
- 已核對 Railway 重啟時間：2026-10-16T23:05:46Z；22 筆 RUNNING 全部在該時間前開始，屬不可能由新容器繼續執行的舊任務。
- 已在 Supabase 將這 22 筆任務結案為 FAILED，記錄「collector restart interrupted」原因；保留歷史，沒有修改行情或指標資料。回查：RUNNING 0、FAILED 30、SUCCEEDED 1878。FAILED 中原本 8 筆為歷史 451，新增 22 筆為中斷結案，不代表 30 個當前故障。
- 28 組 raw_candles 均存在；使用每組相鄰 open_time 的窗口檢查，**28/28 組缺口數均為 0**。OHLC 合法性檢查違規 0 筆；data_quality_issues 未解決 0 筆。仍需外部來源抽樣與收盤對齊驗證。
- 28 組 market_features 均存在，與 raw_candles 同鍵對齊的孤兒特徵 0 筆；sma_200 為 NULL 的 feature 0 筆。每組前 200 根 raw 未寫入 feature，與既定暖機設計一致。指標公式獨立重算仍待驗收。
- 三個 public SECURITY DEFINER RPC 確認 authenticated 有執行權限、anon 無權限；三個函式原始碼均有 auth.uid() 及 app_user_roles 管理員檢查。安全 Advisor 警告仍存在，需評估是否收回舊 RPC 權限或留待前端重建；不可單憑警告判定已被非管理員繞過。
- ai_v2 的資金上限、bundle role 與 active bundle 三類 trigger 均存在，但尚未執行隔離交易的負向測試，**P0.1 尚未封版**。


## P0 續測：公式及保護機制（2026-10-17）
- 由 BTCUSDT 1h 最近 200 根原始收盤價直接在 SQL 重新計算：SMA20=81901.874、SMA200=82633.0675，均與 market_features 最新一根完全一致。
- 全表檢查 bb_middle=sma_20、bb_upper>=bb_middle、bb_lower<=bb_middle、atr_14>=0、0<=rsi_12<=100，違規 0 筆。
- ai_v2.active_model_bundle 負向插入測試：未經批准的 bundle 被 trigger 拒絕，錯誤文字符合預期，測試資料未留存。
- ai_v2.sim_positions 負向插入測試：不存在的模擬帳戶被 trigger 拒絕，錯誤文字符合預期，測試資料未留存。
- 80% 資金上限及同交易對區間重疊仍待建立完整隔離測試資料驗證；MACD/RSI/ATR/KDJ 等需獨立公式數值核對。不可據此宣告 P0 封版。


## P0 續測：資金限制與指標數值（2026-10-17）
- 使用單一 PL/pgSQL DO 區塊與外層例外回滾，建立隔離 research_run、sim_account（10,000）與 decision；驗證 8,001 保留額被 80% cap 拒絕、5,000 正常接受、同商品同週期重疊進場區間被拒絕。測試後 P0_TEST research_runs=0，無殘留。
- BTCUSDT 1h 最新值由 SQL 獨立重算：EMA20 預期 81793.448104271319，儲存 81793.4481042713；EMA50 預期 81972.135994792184，儲存 81972.1359947922，均符合數值精度。
- BTCUSDT 1h 最近 20 根收盤價計算布林中線 81901.874、母體標準差 386.35743838316，推算上軌 82674.5888767663、下軌 81129.1591232337，與資料庫一致。
- MACD histogram 與 macd-signal 的儲存關係可由抽樣值確認，但 MACD/RSI/ATR/KDJ 完整獨立重算仍待執行。P0 不應僅憑抽樣視為全面通過。


## P0.4 使用者驗收決定（2026-10-17）
- 使用者明確指示 P0.4 標記通過，不再等待新版 Railway 部署完成後的排程實測。
- **狀態：使用者接受／通過（免除剩餘實測）**，非「全部技術驗證通過」。
- 已提交修正：collector.py 回傳抓取成功／失敗，worker.py 僅於成功時同步特徵；提交後觀察到 Railway 正在 BUILDING，尚無此次新版部署成功與後續 15 分鐘同步的驗證證據。
- 此決定僅涵蓋 P0.4，不代表 P0.1 資料庫權限與 P0.2 外部行情抽樣自動完成。


## P0 最終封版決定（2026-10-17，優先於上方歷史狀態）
- 使用者明確指示：「P0幫我標記已完成，接下來我們要開始p1了」。**P0 整體狀態更新為「完成／使用者接受驗收」；P1 正式啟動。**
- P0.1 未完成的非管理員權限負向測試／角色矩陣，以及 P0.2 官方 K 線抽樣／最新已收盤邊界檢查，保留為**已知未驗證事項**；使用者同意進入下一階段不等於它們已實測通過。若 P1 權限設計或資料顯示需要，應重新檢查相應風險。
- P0.3、P0.4 先前的使用者接受決定保持有效，不重新要求指標公式完整重算或 P0.4 已免除的部署實測。
- 本次只變更文件狀態，**未修改 Supabase、Railway、原始 K 線或指標資料**。
