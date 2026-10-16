# AI 交易系統 V2｜完整規劃書與 Supabase 資料字典備份

備份日期：2026-10-17（資料庫結構即時讀取）  
GitHub：`jacklin79315/guber-ai-market-data-system`  
Supabase 專案 ID：`xqtsmrzxixkecvaovzfy`  
資料庫 schema：`public`、`ai_v2`  
表數：25（public 5；ai_v2 20）

> 本檔包含 GitHub 當前主規劃書全文與 Supabase 當下實際欄位快照。資料字典的「用途」由已確認規劃及表名推定；未逐項核對程式碼的欄位說明標為推定或待核對。此為**結構與規格備份**，**不含資料列、模型檔案、憑證、密碼或實際資料庫可還原 dump**。不能用本檔直接恢復全部資料。

## 開發階段完整目錄（P0～P7，8 大階段／45 小階段）

以下標題逐項保留正式階段規劃文件中的名稱；完成狀態另見本備份第五部分。

## P0｜資料庫與資料品質驗收

- P0.1 資料庫結構與安全驗收
- P0.2 原始行情資料驗收
- P0.3 技術指標資料驗收
- P0.4 資料抓取與回補機制驗收

## P1｜前端控制中心

- P1.1 登入與權限管理
- P1.2 系統總覽儀表板
- P1.3 商品監測與資料管理
- P1.4 訓練控制介面
- P1.5 專家與模型管理介面
- P1.6 系統設定與通知管理

## P2｜歷史模擬交易引擎

- P2.1 模擬帳戶與資金管理
- P2.2 歷史行情重播引擎
- P2.3 交易撮合與出場機制
- P2.4 影子單機制
- P2.5 交易績效統計
- P2.6 模擬引擎驗收

## P3｜五位 AI 專家

- P3.1 專家共用資料架構
- P3.2 Entry 開倉專家
- P3.3 Reward 風報比專家
- P3.4 Win Probability 勝率專家
- P3.5 Risk/Position 風險倉位專家
- P3.6 Time 時間專家
- P3.7 專家整合驗收

## P4｜Brain 決策引擎

- P4.1 專家協作機制
- P4.2 Brain 決策機制
- P4.3 RETURN 與 WAIT 機制
- P4.4 完整交易建議輸出
- P4.5 Brain 整合驗收

## P5｜診斷與自主學習

- P5.1 獨立診斷 AI
- P5.2 交易與影子單診斷
- P5.3 WAIT 決策診斷
- P5.4 專家責任歸因與回饋
- P5.5 自主迭代訓練引擎
- P5.6 診斷與學習驗收

## P6｜模型驗證與版本管理

- P6.1 專家獨立訓練與驗證
- P6.2 Champion／Challenger 比較
- P6.3 整組模型協作驗證
- P6.4 模型晉升與回退
- P6.5 自主訓練成果驗收

## P7｜市場監測與通知

- P7.1 最新市場資料監測
- P7.2 正式模型決策
- P7.3 訊號有效性檢查
- P7.4 前端交易建議
- P7.5 LINE 通知整合
- P7.6 正式系統整合驗收


---

## 第一部分：目前正式規劃書（全文）

# AI 交易系統 V2｜統一完整規劃書

**版本：2026-10-17 五項補充確認版（取代舊版主規劃）**  
**性質：使用者確認之產品與開發需求；不代表已完成開發或部署。**

> **最高原則**：AI 負責自主訓練、模擬交易、診斷、研究與提出交易建議；Brain 將完整建議通知使用者；**使用者自行手動下單**。不得自動真實下單、連接或管理使用者真實交易帳戶，也不追蹤使用者真實持倉。模擬持倉僅屬研究用途。

## 1. 來源、優先順序與規格管理

- 本規劃整合：使用者提供的 `ai規劃書.docx` 原始對話、2026-10-16「重新設計架構」重建備份、2026-10-17 V2 更新規劃書、GitHub 既有 V2 主規劃，以及本輪使用者逐項確認與五項新增補充。
- 規格衝突時，依序採用：**使用者最新明確確認 > Word 中使用者明確表態 > 已確認的 V2 架構備份 > 舊 GitHub 文件**。助理曾提出但未獲確認的建議不能冒充使用者決策。
- 本檔為唯一現行需求基準；舊規則只列於「已撤銷」章節。後續修改應直接修改對應章節，歷史異動另記錄，不追加互相衝突的補丁。
- 「已確認需求」、「待工程定義」、「已實作」、「已驗證」必須分別標示。

## 2. 系統目的及正式使用方式

1. 系統是使用者私人的 AI 交易研究及決策顧問，不是自動交易機器人。
2. AI 自主學習歷史市場、訓練專家、逐根模擬、診斷錯誤、迭代模型、監測最新行情。
3. Brain 只在交易方案合格時提供完整建議，否則可選擇 WAIT。
4. **每則建議**至少包含：交易對、LONG/SHORT、參考 K 線週期、開倉價格區間、止盈區間、止損區間、風報比、預估勝率與正期望值、建議投入資金、預期持有時間、開單理由、主要技術依據、支持／反對因素、風險與不確定性、模型版本與訊號時間。
5. 大腦透過前端及規劃中的 LINE 通知使用者；使用者自己決定是否手動開單。**不讀取實際成交、不管理真實持倉、不自動執行真實交易**。
6. 訓練與正式環境必須共用**同一套資料處理、五專家、Brain 決策邏輯**；只有最後輸出不同：訓練送模擬器，正式送通知系統。

## 3. 開發順序：前端先於 AI

- **在五位專家及 Brain 的 AI 開發前，先完成可用的前端控制中心。**
- 前端第一階段：登入／管理權限、Binance 商品搜尋與監測名單、資料完整性與最新 K 線、缺漏／回補任務、參數與健康狀態、AI 訓練控制頁面骨架、專家／Brain 狀態頁面骨架、LINE 通知設定預留。
- 尚未完成的 AI 功能應顯示未啟用，不能假裝已能訓練或決策。
- 前端後端授權、管理稽核、金鑰保護；不可直接修改原始行情，不得中斷既有資料收集。
- 建議交付順序：前端與資料健康驗收 → 歷史模擬引擎 → 五專家與 Brain → 診斷及混合自主學習 → 最新行情監測與通知。

## 4. 市場資料與技術特徵

- 來源：Binance 官方原生、**已收盤** K 線（x=true），週期 **15m、1h、4h、1d**；**不使用 5m 向上合成**。四週期不是舊四策略。
- 目標監測名單：BTCUSDT、ETHUSDT、SOLUSDT、BNBUSDT、XRPUSDT、DOGEUSDT、PENGUUSDT；前端可搜尋新增 Binance 支援商品。
- 回補約三年（不足則依上市及可取得歷史）；每 15 分鐘抓最新已收盤 100 根；每日台北時間 09:00 深度回補；新增交易對觸發回補。
- 保存 OHLC、成交量／額、時間、漲跌與振幅等，去重、缺漏檢查、時間對齊、保留來源。
- **原始行情與衍生特徵分離**；不可因 AI 訓練修改原始資料。
- 特徵包括布林、RSI、MACD、SMA／EMA、KDJ、ATR；最早約 200 根作暖機，遞迴計算使用足夠歷史（既定最近約 1000 根），參數需版本化。ADX/DI、ROC 等屬可擴充項目。

## 5. 五位專家、逐級輸入及 Brain

每筆候選交易使用共同的提案 ID、決策時間、當時已知的市場資料快照、版本及理由；後續專家繼承前面資訊，但**不得自行覆寫前一專家負責欄位**。

1. **Entry／開倉專家**：交易對、方向、開倉區間、參考 K 線週期、開倉理由；從技術指標及歷史經驗學習合理成交價、成交機會與錯失機會。
2. **Reward／風報比專家**：繼承 Entry；提出**止盈區間與止損區間（TP 和 SL 均由 Reward 負責）**、風報比、預期收益與損失及理由。
3. **Win Probability／勝率專家**：繼承上述全部；比照歷史技術指標與相似行情，評估成功機率、盈虧分布、成本、是否正期望值與是否值得投入。**不需要參考或等待時間專家**。風報比不能直接當作勝率。
4. **Risk/Position／風險倉位專家**：繼承前述全部及帳戶曝險；判斷風險、分配單筆及剩餘資金、提示集中度／相關性／可能回撤；可 RETURN Reward 修改 TP/SL，**不能自行改寫**。
5. **Time／時間專家**：繼承前述全部；**只增加預期持有時間及時間不確定性**，不重新取代勝率或風險專家，也無獨立否決權。
6. **Brain／決策大腦**：接受所有專家資料，檢查方案一致性、合理性與品質；輸出 **APPROVE／RETURN／REJECT／WAIT**。RETURN 說明原因並回交原專家，重新檢查受影響下游；不得無限循環。可選合格機會或 WAIT，不強制交易。

## 6. 統一模擬帳戶與風險

- **一個模擬帳戶，初始資金 10,000 元**（幣別待確認）；無槓桿；取消舊四資金池。
- **所有同時模擬持倉合計最多占用當下帳戶資金的 80%**；這是模擬引擎強制執行的硬上限，**不是單筆 80%，也不是每次必須用滿 80%**。
- 單筆資金、剩餘資金如何分配、商品相關性、資金占用及後續機會成本，交 Risk/Position 自主學習；重視正期望值與風險調整後報酬。
- 過高集中度造成重大虧損，診斷應給予較嚴格負面回饋；正常機率性虧損不自動判定錯誤。
- 多筆模擬交易可以共存；**同交易對＋同參考週期的未結束交易，其進場區間不得重疊**。不同週期或不重疊區間可並存，但不能重複占用資金。
- 研究支援 LONG／SHORT／WAIT；SHORT 是策略模擬方向，不因實際現貨工具限制而改變本系統「通知後由使用者手動操作」的定位；模擬成本及假設須一致揭露。

## 7. 歷史模擬與不可變更的掛單規則

1. 僅用當時已收盤且已知的 K 線與特徵決策；**決策當根不得成交，最早下一根才可成交**。
2. APPROVE 後按原核准開倉區間等待進場。
3. **最終已確認：在尚未到達開倉區間之前，價格如果先觸及止盈區間或止損區間，立即取消該筆待成交訂單。** 不算已成交、不產生模擬帳戶損益。**不得再反覆要求使用者確認這條規則。**
4. 同一根 K 線同時觸及 TP 與 SL：**比較該根收盤價與 TP／SL 的距離，較近者判定先觸及，完全相同則視為 SL**；不引入更小週期推算先後。
5. 撮合器須以一致、可重現的工程規則處理進場區間成交價、跳空、同根進場與出場事件先後、手續費與滑價；不得事後選擇最有利價格。
6. **未成交影子單**：保存原核准提案、取消時間／原因、後續行情與反事實評估。錯過合理可得的盈利機會對 Entry 給負面學習回饋；避免原本可能虧損的交易給正面回饋；不明確者交診斷 AI。影子結果**不計入模擬帳戶實際損益**，不得事後改寫開倉價或挑選最佳結果。
7. Word 歷史曾出現固定期限 A 的選擇，但沒有最終確定期限數值；**本輪明確的 TP/SL 先觸及即取消是必須實作的條件**，不得擅自加上未確認的提前取消時限。

## 8. 獨立且可自主學習的診斷 AI

- 診斷引擎獨立於專家及 Brain，不負責核准交易。
- **所有已結算模擬交易（贏／輸）、未成交影子單、WAIT／退回決策**都可納入診斷。
- **先判斷決策品質及主要／次要責任，再給予學習回饋**；主要責任影響較重。合理風險下的虧損不因虧錢自動懲罰；碰巧賺錢的錯誤決策仍須診斷。
- Entry：進場合理性、成交機會與影子單錯失成本。Reward：TP／SL 與 RR。Win：機率校準及正期望值。Risk：資金配置、曝險、集中度及回撤。Time：持倉時間預測。Brain：整體決策、退回與 WAIT 品質。
- **WAIT 也是正式診斷事件**：保留當時理由、專家意見與後續行情，評估合理等待、過度保守、錯失機會或成功避險；不得只用事後漲跌判定當時必然應交易。
- 診斷 AI 自身亦須驗證與改進，避免錯誤歸因造成循環污染。
- **舊固定 0–100 總分與機械盈虧加扣分已取消**；影子單正負回饋、預測誤差及診斷量化仍可作為學習訊號，不等於恢復舊制度。

## 9. 混合自主訓練、驗證與升級保護

- 每輪完整依時間順序重播 **24 個月**歷史，模擬、診斷、更新 Challenger；可一次執行約 **100 輪真正有模型／決策更新的迭代**，不是同一模型無變化重跑 100 次。
- **混合學習**：反覆研究既有歷史改善進場與判斷，同時以未參與調參的新增行情／獨立樣本驗證泛化能力。歷史訓練邊際改善可能遞減、可能過擬合，但不代表未來能力必然遞減。
- 允許相似行情反覆學習，不強制 30 天 Embargo；新行情完成獨立驗證後可成為下一輪訓練資料。嚴禁在歷史決策偷看未來。
- 測試環境：五專家、Brain、診斷 AI 可以各自訓練候選版本；單獨替換某一專家、其他版本固定，進行公平比較。
- 正式環境：**整組版本協作驗證後才部署**；固定資料、模擬資金、成本、其他專家版本及評估窗口。獨立進步但整體變差不得晉升。
- **訓練可以持續，但最新輪次不自動成為正式 Champion**。Challenger 未通過獨立驗證及整體協作比較時，保留原 Champion，保存失敗原因與回退能力。
- 報表包括淨報酬、年化、最大回撤、勝率、盈虧比、交易次數、成交率、錯失機會、資金效率、預測校準與新行情表現；不恢復年化 10%／勝率 70% 等硬門檻。

## 10. BTC 跨商品學習及市場狀態

- BTC 作為加密貨幣市場背景；ETH、SOL、DOGE 等可參考 BTC 學得的歷史行情與技術指標經驗。
- 保留各幣種自己的波動、流動性、相關性、量價與行為差異；由 AI 學習共享經驗的適用程度，不強迫同方向。
- 市場狀態引擎屬後續規劃：盤整、等待突破／跌破、確認突破／跌破、多空趨勢、高波動、結構不明、WAIT；提供支撐阻力、價格區間位置及 BTC Context。**未驗證前不得聲稱已實作**。

## 11. 正式市場監測、有效性檢查與通知

- 正式環境使用與訓練相同的資料處理、專家模型、Brain 決策流程，監測最新可得的已收盤行情。
- **發送通知前**，以最新可得價格確認原核准方案仍有效；若在通知前已觸發原掛單取消／失效條件，**抑制過期通知並記錄原因**。這只檢查有效性，不自行改開倉、TP/SL，也不自動重跑專家。
- 通知內容：交易對、方向、開倉區間、止盈區間、止損區間、RR、建議投入資金、預期持有時間、成功機率與正期望值、參考週期、詳細開單理由、風險提示、決策版本及時間。
- 使用者收到建議後**自行手動下單**；系統不要求回報是否成交、不追蹤實際持倉，也不代替使用者下單。

## 12. 資料庫、報表及稽核

- 現有原始行情、技術指標、watchlist、抓取／回補任務與資料品質記錄持續保護；新增或沿用提案版本、專家審查、Brain 決策、模擬持倉、影子單、診斷、責任歸因、回饋、訓練輪次、Champion／Challenger、通知快照、管理稽核等邏輯資料。
- 前端呈現資料健康、回補進度、訓練進度、專家版本、診斷與 WAIT、影子單、交易績效及新行情驗證；影子單不得混入已實現模擬損益。
- 訊號發布時的資料與模型版本須可追溯，不得事後覆寫原始核准方案。
- 實際 Supabase 表名與欄位在實作前盤點；本文是規格，**不是已完成資料表清單**。

## 13. 開發里程碑與驗收

1. **P1 前端優先／資料健康**：登入權限、監測名單、資料與回補管理、AI 控制頁骨架；確認七商品四週期資料完整且不干擾收集。
2. **P2 模擬引擎**：逐根模擬、下一根成交、TP/SL 取消、同根判定、影子單、成本、單帳戶 80% 限制、多持倉與可重現測試。
3. **P3 五專家＋Brain**：統一資料契約、逐級審查、RETURN／WAIT、完整交易建議。
4. **P4 診斷與自主訓練**：已結算及影子診斷、WAIT、24 個月／100 輪混合訓練、獨立升級、整組 Champion／Challenger 驗證。
5. **P5 監測與通知**：相同決策邏輯、通知前有效性檢查、前端／LINE 完整建議，供使用者手動下單。

## 14. 明確撤銷、不得復活的舊規格

- 舊四種固定交易策略（日內、1–3 日、一週、15–30 天）與四獨立資金池。
- 舊固定 0–100 分制度、固定盈虧加扣分、年化 10%／勝率 70%／65 分硬門檻。
- 強制 30 天訓練空窗；舊 16 個月學習＋4 個月測試作為每輪唯一流程。
- 自動真實下單、真實帳戶連接、真實持倉追蹤管理。
- 使用 5m 聚合代替原生 K 線；使用更小週期還原同根 TP/SL。
- 將「80%」誤寫成單筆最高投入；目前是**所有同時持倉合計 80%**。

## 15. 待工程定義，不能冒稱使用者已確認

- 10,000 元模擬資金的幣別、具體手續費與滑價、SHORT 模擬成本。
- 限價區間的成交價、跳空、同根進場與出場先後等一致且可重現的撮合細則。
- 影子單反事實比較方式與觀察窗口；Word 曾選固定期限 A 但未落實數值，**不得擅自增設提前到期**。
- 指標精確參數、勝率校準、診斷回饋強度、正式晉升統計標準、LINE 通知頻率及前端權限矩陣。
- GitHub、Railway、Supabase 的**實際部署／資料表／資料品質狀態仍須另行核驗**。

---

**來源註記**：本檔依使用者提供的 Word 原始對話、V2 架構備份、先前 V2 整合 Word 規劃及 2026-10-17 最新逐項決策重整。完整原始備份與對話應另行保留作歷史佐證；本檔為現行規格，不是逐字對話紀錄。


---

## 第二部分：資料庫結構與欄位字典

欄位表逐項列出名稱、PostgreSQL 型別、是否可為 NULL、預設值及中文用途。型別／NULL／預設值來自資料庫，中文用途為文件化解讀。技術指標是否持續自動計算尚未驗證，**不能因為 market_features 有資料就視為程序已啟動**。

### `public.market_data_watchlist`

**用途：** Binance 商品監測名單、啟用狀態與回補設定  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `bigint` | 不可 | `—` | 主鍵／唯一識別碼 |
| `source` | `text` | 不可 | `'BINANCE'::text` | 資料欄位：source（語意待與程式碼核對） |
| `market` | `text` | 不可 | `'SPOT'::text` | 資料欄位：market（語意待與程式碼核對） |
| `symbol` | `text` | 不可 | `—` | 交易對代碼 |
| `enabled` | `boolean` | 不可 | `true` | 啟用狀態 |
| `lookback_years` | `smallint` | 不可 | `3` | 資料欄位：lookback_years（語意待與程式碼核對） |
| `intervals` | `ARRAY` | 不可 | `ARRAY['15m'::text, '1h'::text, '4h'::text, '1d'::text]` | 資料欄位：intervals（語意待與程式碼核對） |
| `backfill_requested_at` | `timestamp with time zone` | 不可 | `now()` | 事件時間戳 |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |
| `updated_at` | `timestamp with time zone` | 不可 | `now()` | 更新時間 |

### `public.raw_candles`

**用途：** 官方已收盤 K 線原始資料；不可被 AI 訓練覆寫  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `bigint` | 不可 | `—` | 主鍵／唯一識別碼 |
| `source` | `text` | 不可 | `—` | 資料欄位：source（語意待與程式碼核對） |
| `market` | `text` | 不可 | `—` | 資料欄位：market（語意待與程式碼核對） |
| `symbol` | `text` | 不可 | `—` | 交易對代碼 |
| `timeframe` | `text` | 不可 | `—` | K 線週期 |
| `open_time` | `bigint` | 不可 | `—` | K 線開盤時間 |
| `open_price` | `text` | 不可 | `—` | 行情價格／時間或其衍生數值 |
| `high_price` | `text` | 不可 | `—` | 行情價格／時間或其衍生數值 |
| `low_price` | `text` | 不可 | `—` | 行情價格／時間或其衍生數值 |
| `close_price` | `text` | 不可 | `—` | 行情價格／時間或其衍生數值 |
| `base_volume` | `text` | 不可 | `—` | 成交量／成交額相關數值 |
| `close_time` | `bigint` | 不可 | `—` | K 線收盤時間 |
| `quote_volume` | `text` | 不可 | `—` | 成交量／成交額相關數值 |
| `trade_count` | `bigint` | 不可 | `—` | 統計量／比例或變動值 |
| `taker_buy_base_volume` | `text` | 不可 | `—` | 成交量／成交額相關數值 |
| `taker_buy_quote_volume` | `text` | 不可 | `—` | 成交量／成交額相關數值 |
| `ignore_value` | `text` | 不可 | `—` | 資料欄位：ignore_value（語意待與程式碼核對） |
| `collected_at` | `timestamp with time zone` | 不可 | `now()` | 事件時間戳 |

### `public.ingestion_jobs`

**用途：** 行情抓取、歷史回補、資料稽核工作排程與執行狀態  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `bigint` | 不可 | `—` | 主鍵／唯一識別碼 |
| `job_type` | `text` | 不可 | `—` | 資料欄位：job_type（語意待與程式碼核對） |
| `source` | `text` | 不可 | `'BINANCE'::text` | 資料欄位：source（語意待與程式碼核對） |
| `market` | `text` | 不可 | `'SPOT'::text` | 資料欄位：market（語意待與程式碼核對） |
| `symbol` | `text` | 不可 | `—` | 交易對代碼 |
| `timeframe` | `text` | 不可 | `—` | K 線週期 |
| `status` | `text` | 不可 | `'PENDING'::text` | 流程狀態 |
| `from_open_time` | `bigint` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `to_open_time` | `bigint` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `inserted_count` | `integer` | 不可 | `0` | 統計量／比例或變動值 |
| `duplicate_count` | `integer` | 不可 | `0` | 統計量／比例或變動值 |
| `issue_count` | `integer` | 不可 | `0` | 統計量／比例或變動值 |
| `error_message` | `text` | 可 | `—` | 錯誤訊息 |
| `requested_at` | `timestamp with time zone` | 不可 | `now()` | 事件時間戳 |
| `started_at` | `timestamp with time zone` | 可 | `—` | 事件時間戳 |
| `completed_at` | `timestamp with time zone` | 可 | `—` | 事件時間戳 |

### `public.data_quality_issues`

**用途：** 資料缺口、品質異常及修復追蹤  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `bigint` | 不可 | `—` | 主鍵／唯一識別碼 |
| `source` | `text` | 不可 | `—` | 資料欄位：source（語意待與程式碼核對） |
| `market` | `text` | 不可 | `—` | 資料欄位：market（語意待與程式碼核對） |
| `symbol` | `text` | 不可 | `—` | 交易對代碼 |
| `timeframe` | `text` | 不可 | `—` | K 線週期 |
| `open_time` | `bigint` | 可 | `—` | K 線開盤時間 |
| `issue_type` | `text` | 不可 | `—` | 資料欄位：issue_type（語意待與程式碼核對） |
| `expected_payload` | `jsonb` | 可 | `—` | 資料欄位：expected_payload（語意待與程式碼核對） |
| `observed_payload` | `jsonb` | 可 | `—` | 資料欄位：observed_payload（語意待與程式碼核對） |
| `resolved` | `boolean` | 不可 | `false` | 資料欄位：resolved（語意待與程式碼核對） |
| `detected_at` | `timestamp with time zone` | 不可 | `now()` | 事件時間戳 |
| `resolved_at` | `timestamp with time zone` | 可 | `—` | 事件時間戳 |

### `public.market_features`

**用途：** 由原始 K 線衍生的技術指標與計算欄位；計算程序目前尚未確認啟動  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `bigint` | 不可 | `—` | 主鍵／唯一識別碼 |
| `source` | `text` | 不可 | `—` | 資料欄位：source（語意待與程式碼核對） |
| `market` | `text` | 不可 | `—` | 資料欄位：market（語意待與程式碼核對） |
| `symbol` | `text` | 不可 | `—` | 交易對代碼 |
| `timeframe` | `text` | 不可 | `—` | K 線週期 |
| `open_time` | `bigint` | 不可 | `—` | K 線開盤時間 |
| `open_price` | `text` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `high_price` | `text` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `low_price` | `text` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `close_price` | `text` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `base_volume` | `text` | 可 | `—` | 成交量／成交額相關數值 |
| `close_time` | `bigint` | 不可 | `—` | K 線收盤時間 |
| `quote_volume` | `text` | 可 | `—` | 成交量／成交額相關數值 |
| `trade_count` | `bigint` | 可 | `—` | 統計量／比例或變動值 |
| `taker_buy_base_volume` | `text` | 可 | `—` | 成交量／成交額相關數值 |
| `taker_buy_quote_volume` | `text` | 可 | `—` | 成交量／成交額相關數值 |
| `ignore_value` | `text` | 可 | `—` | 資料欄位：ignore_value（語意待與程式碼核對） |
| `sma_20` | `double precision` | 可 | `—` | 技術指標／衍生特徵：sma_20 |
| `sma_50` | `double precision` | 可 | `—` | 技術指標／衍生特徵：sma_50 |
| `sma_100` | `double precision` | 可 | `—` | 技術指標／衍生特徵：sma_100 |
| `sma_200` | `double precision` | 可 | `—` | 技術指標／衍生特徵：sma_200 |
| `ema_20` | `double precision` | 可 | `—` | 技術指標／衍生特徵：ema_20 |
| `ema_50` | `double precision` | 可 | `—` | 技術指標／衍生特徵：ema_50 |
| `ema_100` | `double precision` | 可 | `—` | 技術指標／衍生特徵：ema_100 |
| `ema_200` | `double precision` | 可 | `—` | 技術指標／衍生特徵：ema_200 |
| `rsi_6` | `double precision` | 可 | `—` | 技術指標／衍生特徵：rsi_6 |
| `rsi_12` | `double precision` | 可 | `—` | 技術指標／衍生特徵：rsi_12 |
| `rsi_24` | `double precision` | 可 | `—` | 技術指標／衍生特徵：rsi_24 |
| `macd` | `double precision` | 可 | `—` | 技術指標／衍生特徵：macd |
| `macd_signal` | `double precision` | 可 | `—` | 技術指標／衍生特徵：macd_signal |
| `macd_histogram` | `double precision` | 可 | `—` | 技術指標／衍生特徵：macd_histogram |
| `stoch_k` | `double precision` | 可 | `—` | 技術指標／衍生特徵：stoch_k |
| `stoch_d` | `double precision` | 可 | `—` | 技術指標／衍生特徵：stoch_d |
| `adx_14` | `double precision` | 可 | `—` | 技術指標／衍生特徵：adx_14 |
| `plus_di_14` | `double precision` | 可 | `—` | 資料欄位：plus_di_14（語意待與程式碼核對） |
| `minus_di_14` | `double precision` | 可 | `—` | 資料欄位：minus_di_14（語意待與程式碼核對） |
| `atr_14` | `double precision` | 可 | `—` | 技術指標／衍生特徵：atr_14 |
| `atr_percent` | `double precision` | 可 | `—` | 技術指標／衍生特徵：atr_percent |
| `bb_upper` | `double precision` | 可 | `—` | 技術指標／衍生特徵：bb_upper |
| `bb_middle` | `double precision` | 可 | `—` | 技術指標／衍生特徵：bb_middle |
| `bb_lower` | `double precision` | 可 | `—` | 技術指標／衍生特徵：bb_lower |
| `bb_width` | `double precision` | 可 | `—` | 技術指標／衍生特徵：bb_width |
| `volume_ma_20` | `double precision` | 可 | `—` | 成交量／成交額相關數值 |
| `volume_ma_50` | `double precision` | 可 | `—` | 成交量／成交額相關數值 |
| `volume_ratio` | `double precision` | 可 | `—` | 成交量／成交額相關數值 |
| `candle_body` | `double precision` | 可 | `—` | 資料欄位：candle_body（語意待與程式碼核對） |
| `upper_wick` | `double precision` | 可 | `—` | 資料欄位：upper_wick（語意待與程式碼核對） |
| `lower_wick` | `double precision` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `body_ratio` | `double precision` | 可 | `—` | 統計量／比例或變動值 |
| `upper_wick_ratio` | `double precision` | 可 | `—` | 統計量／比例或變動值 |
| `lower_wick_ratio` | `double precision` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `return_1` | `double precision` | 可 | `—` | 資料欄位：return_1（語意待與程式碼核對） |
| `return_3` | `double precision` | 可 | `—` | 資料欄位：return_3（語意待與程式碼核對） |
| `return_5` | `double precision` | 可 | `—` | 資料欄位：return_5（語意待與程式碼核對） |
| `return_10` | `double precision` | 可 | `—` | 資料欄位：return_10（語意待與程式碼核對） |
| `sma_slope_20` | `double precision` | 可 | `—` | 技術指標／衍生特徵：sma_slope_20 |
| `sma_slope_50` | `double precision` | 可 | `—` | 技術指標／衍生特徵：sma_slope_50 |
| `sma_slope_100` | `double precision` | 可 | `—` | 技術指標／衍生特徵：sma_slope_100 |
| `sma_slope_200` | `double precision` | 可 | `—` | 技術指標／衍生特徵：sma_slope_200 |
| `ema_slope_20` | `double precision` | 可 | `—` | 技術指標／衍生特徵：ema_slope_20 |
| `ema_slope_50` | `double precision` | 可 | `—` | 技術指標／衍生特徵：ema_slope_50 |
| `ema_slope_100` | `double precision` | 可 | `—` | 技術指標／衍生特徵：ema_slope_100 |
| `ema_slope_200` | `double precision` | 可 | `—` | 技術指標／衍生特徵：ema_slope_200 |
| `rsi_6_change` | `double precision` | 可 | `—` | 技術指標／衍生特徵：rsi_6_change |
| `rsi_12_change` | `double precision` | 可 | `—` | 技術指標／衍生特徵：rsi_12_change |
| `rsi_24_change` | `double precision` | 可 | `—` | 技術指標／衍生特徵：rsi_24_change |
| `rsi_6_acceleration` | `double precision` | 可 | `—` | 技術指標／衍生特徵：rsi_6_acceleration |
| `rsi_12_acceleration` | `double precision` | 可 | `—` | 技術指標／衍生特徵：rsi_12_acceleration |
| `rsi_24_acceleration` | `double precision` | 可 | `—` | 技術指標／衍生特徵：rsi_24_acceleration |
| `macd_change` | `double precision` | 可 | `—` | 技術指標／衍生特徵：macd_change |
| `macd_signal_change` | `double precision` | 可 | `—` | 技術指標／衍生特徵：macd_signal_change |
| `macd_histogram_change` | `double precision` | 可 | `—` | 技術指標／衍生特徵：macd_histogram_change |
| `price_sma_ratio_20` | `double precision` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `price_sma_ratio_50` | `double precision` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `price_sma_ratio_100` | `double precision` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `price_sma_ratio_200` | `double precision` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `price_ema_ratio_20` | `double precision` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `price_ema_ratio_50` | `double precision` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `price_ema_ratio_100` | `double precision` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `price_ema_ratio_200` | `double precision` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `distance_to_sma_20` | `double precision` | 可 | `—` | 資料欄位：distance_to_sma_20（語意待與程式碼核對） |
| `distance_to_sma_50` | `double precision` | 可 | `—` | 資料欄位：distance_to_sma_50（語意待與程式碼核對） |
| `distance_to_sma_100` | `double precision` | 可 | `—` | 資料欄位：distance_to_sma_100（語意待與程式碼核對） |
| `distance_to_sma_200` | `double precision` | 可 | `—` | 資料欄位：distance_to_sma_200（語意待與程式碼核對） |
| `distance_to_ema_20` | `double precision` | 可 | `—` | 資料欄位：distance_to_ema_20（語意待與程式碼核對） |
| `distance_to_ema_50` | `double precision` | 可 | `—` | 資料欄位：distance_to_ema_50（語意待與程式碼核對） |
| `distance_to_ema_100` | `double precision` | 可 | `—` | 資料欄位：distance_to_ema_100（語意待與程式碼核對） |
| `distance_to_ema_200` | `double precision` | 可 | `—` | 資料欄位：distance_to_ema_200（語意待與程式碼核對） |
| `bollinger_zscore` | `double precision` | 可 | `—` | 技術指標／衍生特徵：bollinger_zscore |

### `ai_v2.research_runs`

**用途：** 歷史訓練／驗證輪次、時間窗口、資料版本、參數及績效  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `status` | `text` | 不可 | `'PENDING'::text` | 流程狀態 |
| `symbol` | `text` | 不可 | `—` | 交易對代碼 |
| `timeframe` | `text` | 不可 | `—` | K 線週期 |
| `training_start` | `timestamp with time zone` | 不可 | `—` | 訓練資料開始時間 |
| `training_end` | `timestamp with time zone` | 不可 | `—` | 訓練資料結束時間 |
| `seed` | `bigint` | 不可 | `—` | 隨機種子 |
| `data_fingerprint` | `text` | 可 | `—` | 訓練資料指紋 |
| `code_revision` | `text` | 不可 | `—` | 程式碼版本 |
| `config` | `jsonb` | 不可 | `'{}'::jsonb` | 執行設定 |
| `metrics` | `jsonb` | 可 | `—` | 績效統計 |
| `error_message` | `text` | 可 | `—` | 錯誤訊息 |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |
| `started_at` | `timestamp with time zone` | 可 | `—` | 事件時間戳 |
| `finished_at` | `timestamp with time zone` | 可 | `—` | 事件時間戳 |

**外鍵關聯：**
- `sim_accounts_run_id_fkey`：`ai_v2.sim_accounts(run_id)` → `ai_v2.research_runs(id)`
- `model_bundle_events_run_id_fkey`：`ai_v2.model_bundle_events(run_id)` → `ai_v2.research_runs(id)`
- `expert_versions_training_run_id_fkey`：`ai_v2.expert_versions(training_run_id)` → `ai_v2.research_runs(id)`
- `decisions_run_id_fkey`：`ai_v2.decisions(run_id)` → `ai_v2.research_runs(id)`
- `diagnostics_run_id_fkey`：`ai_v2.diagnostics(run_id)` → `ai_v2.research_runs(id)`
- `shadow_orders_run_id_fkey`：`ai_v2.shadow_orders(run_id)` → `ai_v2.research_runs(id)`
- `model_bundles_evaluation_run_id_fkey`：`ai_v2.model_bundles(evaluation_run_id)` → `ai_v2.research_runs(id)`

### `ai_v2.expert_versions`

**用途：** 五專家、Brain、診斷 AI 各自的模型版本與產物資訊  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `role` | `text` | 不可 | `—` | 專家角色 |
| `version` | `text` | 不可 | `—` | 版本名稱 |
| `artifact_uri` | `text` | 可 | `—` | 模型產物位置 |
| `artifact_hash` | `text` | 可 | `—` | 模型產物校驗值 |
| `training_run_id` | `uuid` | 可 | `—` | 資料欄位：training_run_id（語意待與程式碼核對） |
| `metadata` | `jsonb` | 不可 | `'{}'::jsonb` | 額外版本或物件中繼資料 |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |

**外鍵關聯：**
- `model_bundles_brain_version_id_fkey`：`ai_v2.model_bundles(brain_version_id)` → `ai_v2.expert_versions(id)`
- `expert_reviews_expert_version_id_fkey`：`ai_v2.expert_reviews(expert_version_id)` → `ai_v2.expert_versions(id)`
- `expert_versions_training_run_id_fkey`：`ai_v2.expert_versions(training_run_id)` → `ai_v2.research_runs(id)`
- `champions_expert_version_id_fkey`：`ai_v2.champions(expert_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_entry_version_id_fkey`：`ai_v2.model_bundles(entry_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_reward_version_id_fkey`：`ai_v2.model_bundles(reward_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_win_version_id_fkey`：`ai_v2.model_bundles(win_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_risk_version_id_fkey`：`ai_v2.model_bundles(risk_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_time_version_id_fkey`：`ai_v2.model_bundles(time_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_diagnostic_version_id_fkey`：`ai_v2.model_bundles(diagnostic_version_id)` → `ai_v2.expert_versions(id)`
- `diagnostics_diagnostic_version_id_fkey`：`ai_v2.diagnostics(diagnostic_version_id)` → `ai_v2.expert_versions(id)`

### `ai_v2.champions`

**用途：** 舊有單角色 Champion 指標；正式整組版本以 active_model_bundle 為準  
**RLS：** 已啟用  
**主鍵：** role

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `role` | `text` | 不可 | `—` | 專家角色 |
| `expert_version_id` | `uuid` | 不可 | `—` | 資料欄位：expert_version_id（語意待與程式碼核對） |
| `promoted_at` | `timestamp with time zone` | 不可 | `now()` | 事件時間戳 |
| `promotion_reason` | `text` | 不可 | `—` | 資料欄位：promotion_reason（語意待與程式碼核對） |

**外鍵關聯：**
- `champions_expert_version_id_fkey`：`ai_v2.champions(expert_version_id)` → `ai_v2.expert_versions(id)`

### `ai_v2.decisions`

**用途：** Brain 決策及入場、TP/SL、勝率、資金、時間、資料快照  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `run_id` | `uuid` | 不可 | `—` | 關聯研究或訓練輪次 |
| `symbol` | `text` | 不可 | `—` | 交易對代碼 |
| `timeframe` | `text` | 不可 | `—` | K 線週期 |
| `decision_open_time` | `bigint` | 不可 | `—` | 行情價格／時間或其衍生數值 |
| `action` | `text` | 不可 | `—` | 決策或操作類型 |
| `direction` | `text` | 可 | `—` | LONG／SHORT 方向 |
| `entry_low` | `numeric` | 可 | `—` | 預計進場區間下界 |
| `entry_high` | `numeric` | 可 | `—` | 預計進場區間上界 |
| `stop_low` | `numeric` | 可 | `—` | 停損區間下界 |
| `stop_high` | `numeric` | 可 | `—` | 停損區間上界 |
| `take_profit_low` | `numeric` | 可 | `—` | 止盈區間下界 |
| `take_profit_high` | `numeric` | 可 | `—` | 止盈區間上界 |
| `proposed_fraction` | `numeric` | 可 | `—` | 提議資金比例（非總占用上限的唯一保障） |
| `expert_outputs` | `jsonb` | 不可 | `'{}'::jsonb` | 專家輸出快照 |
| `brain_reason` | `jsonb` | 不可 | `'{}'::jsonb` | Brain 決策理由 |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |
| `model_bundle_id` | `uuid` | 可 | `—` | 使用的整組模型版本 |
| `market_snapshot` | `jsonb` | 可 | `—` | 決策當下可見市場資料快照 |
| `market_snapshot_hash` | `text` | 可 | `—` | 市場快照雜湊 |
| `expected_value` | `numeric` | 可 | `—` | 預估期望值 |
| `win_probability` | `numeric` | 可 | `—` | 預估勝率 |
| `expected_hold_minutes` | `integer` | 可 | `—` | 預估持有分鐘數 |
| `decision_revision` | `integer` | 不可 | `1` | 資料欄位：decision_revision（語意待與程式碼核對） |

**外鍵關聯：**
- `diagnostics_decision_id_fkey`：`ai_v2.diagnostics(decision_id)` → `ai_v2.decisions(id)`
- `shadow_orders_decision_id_fkey`：`ai_v2.shadow_orders(decision_id)` → `ai_v2.decisions(id)`
- `sim_positions_decision_id_fkey`：`ai_v2.sim_positions(decision_id)` → `ai_v2.decisions(id)`
- `decisions_model_bundle_id_fkey`：`ai_v2.decisions(model_bundle_id)` → `ai_v2.model_bundles(id)`
- `expert_reviews_decision_id_fkey`：`ai_v2.expert_reviews(decision_id)` → `ai_v2.decisions(id)`
- `simulated_trades_decision_id_fkey`：`ai_v2.simulated_trades(decision_id)` → `ai_v2.decisions(id)`
- `signal_notifications_decision_id_fkey`：`ai_v2.signal_notifications(decision_id)` → `ai_v2.decisions(id)`
- `decisions_run_id_fkey`：`ai_v2.decisions(run_id)` → `ai_v2.research_runs(id)`

### `ai_v2.simulated_trades`

**用途：** 已模擬成交交易與費用、滑價、淨損益  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `decision_id` | `uuid` | 不可 | `—` | 關聯決策紀錄 |
| `entry_open_time` | `bigint` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `exit_open_time` | `bigint` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `fill_price` | `numeric` | 可 | `—` | 模擬成交價 |
| `exit_price` | `numeric` | 可 | `—` | 模擬出場價 |
| `position_size` | `numeric` | 可 | `—` | 模擬倉位數量 |
| `fee_paid` | `numeric` | 不可 | `0` | 模擬手續費 |
| `slippage_paid` | `numeric` | 不可 | `0` | 模擬滑價成本 |
| `net_pnl` | `numeric` | 可 | `—` | 扣除成本後淨損益 |
| `exit_reason` | `text` | 可 | `—` | 資料欄位：exit_reason（語意待與程式碼核對） |
| `result` | `jsonb` | 不可 | `'{}'::jsonb` | 執行結果 |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |
| `account_id` | `uuid` | 可 | `—` | 模擬帳戶識別碼 |
| `position_id` | `uuid` | 可 | `—` | 模擬持倉識別碼 |
| `model_bundle_id` | `uuid` | 可 | `—` | 使用的整組模型版本 |

**外鍵關聯：**
- `simulated_trades_position_id_fkey`：`ai_v2.simulated_trades(position_id)` → `ai_v2.sim_positions(id)`
- `simulated_trades_decision_id_fkey`：`ai_v2.simulated_trades(decision_id)` → `ai_v2.decisions(id)`
- `simulated_trades_account_id_fkey`：`ai_v2.simulated_trades(account_id)` → `ai_v2.sim_accounts(id)`
- `simulated_trades_model_bundle_id_fkey`：`ai_v2.simulated_trades(model_bundle_id)` → `ai_v2.model_bundles(id)`

### `ai_v2.diagnostics`

**用途：** 診斷 AI 對成交、影子單、WAIT、退回等事件的判斷  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `run_id` | `uuid` | 不可 | `—` | 關聯研究或訓練輪次 |
| `decision_id` | `uuid` | 可 | `—` | 關聯決策紀錄 |
| `responsible_role` | `text` | 可 | `—` | 資料欄位：responsible_role（語意待與程式碼核對） |
| `diagnosis` | `jsonb` | 不可 | `—` | 資料欄位：diagnosis（語意待與程式碼核對） |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |
| `event_type` | `text` | 可 | `—` | 事件類別 |
| `diagnostic_version_id` | `uuid` | 可 | `—` | 資料欄位：diagnostic_version_id（語意待與程式碼核對） |
| `evidence_snapshot` | `jsonb` | 可 | `—` | 資料欄位：evidence_snapshot（語意待與程式碼核對） |

**外鍵關聯：**
- `diagnostic_attributions_diagnosis_id_fkey`：`ai_v2.diagnostic_attributions(diagnosis_id)` → `ai_v2.diagnostics(id)`
- `diagnostics_diagnostic_version_id_fkey`：`ai_v2.diagnostics(diagnostic_version_id)` → `ai_v2.expert_versions(id)`
- `diagnostics_run_id_fkey`：`ai_v2.diagnostics(run_id)` → `ai_v2.research_runs(id)`
- `diagnostics_decision_id_fkey`：`ai_v2.diagnostics(decision_id)` → `ai_v2.decisions(id)`
- `shadow_orders_diagnosis_id_fkey`：`ai_v2.shadow_orders(diagnosis_id)` → `ai_v2.diagnostics(id)`

### `ai_v2.shadow_orders`

**用途：** 進場前先觸及 TP/SL 的取消掛單及反事實評估，不入帳損益  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `decision_id` | `uuid` | 不可 | `—` | 關聯決策紀錄 |
| `run_id` | `uuid` | 不可 | `—` | 關聯研究或訓練輪次 |
| `symbol` | `text` | 不可 | `—` | 交易對代碼 |
| `timeframe` | `text` | 不可 | `—` | K 線週期 |
| `direction` | `text` | 不可 | `—` | LONG／SHORT 方向 |
| `decision_open_time` | `bigint` | 不可 | `—` | 行情價格／時間或其衍生數值 |
| `entry_low` | `numeric` | 不可 | `—` | 預計進場區間下界 |
| `entry_high` | `numeric` | 不可 | `—` | 預計進場區間上界 |
| `tp_low` | `numeric` | 不可 | `—` | 止盈區間下界 |
| `tp_high` | `numeric` | 不可 | `—` | 止盈區間上界 |
| `sl_low` | `numeric` | 不可 | `—` | 停損區間下界 |
| `sl_high` | `numeric` | 不可 | `—` | 停損區間上界 |
| `cancellation_reason` | `text` | 不可 | `—` | 進場前取消原因 |
| `cancelled_open_time` | `bigint` | 不可 | `—` | 行情價格／時間或其衍生數值 |
| `hypothetical_entry_open_time` | `bigint` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `hypothetical_exit_open_time` | `bigint` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `hypothetical_pnl` | `numeric` | 可 | `—` | 影子反事實損益；不入模擬帳戶 |
| `evaluation_status` | `text` | 不可 | `'PENDING'::text` | 評估進度 |
| `feedback_direction` | `text` | 可 | `—` | 資料欄位：feedback_direction（語意待與程式碼核對） |
| `evidence` | `jsonb` | 不可 | `'{}'::jsonb` | 診斷或反事實評估依據 |
| `diagnosis_id` | `uuid` | 可 | `—` | 關聯診斷 |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |
| `model_bundle_id` | `uuid` | 可 | `—` | 使用的整組模型版本 |
| `market_snapshot_hash` | `text` | 可 | `—` | 市場快照雜湊 |

**外鍵關聯：**
- `shadow_orders_decision_id_fkey`：`ai_v2.shadow_orders(decision_id)` → `ai_v2.decisions(id)`
- `shadow_orders_run_id_fkey`：`ai_v2.shadow_orders(run_id)` → `ai_v2.research_runs(id)`
- `shadow_orders_diagnosis_id_fkey`：`ai_v2.shadow_orders(diagnosis_id)` → `ai_v2.diagnostics(id)`
- `shadow_orders_model_bundle_id_fkey`：`ai_v2.shadow_orders(model_bundle_id)` → `ai_v2.model_bundles(id)`

### `ai_v2.model_bundles`

**用途：** 五專家＋Brain＋診斷版本的整組 Challenger/Champion 候選及驗證資料  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `version` | `text` | 不可 | `—` | 版本名稱 |
| `status` | `text` | 不可 | `'CANDIDATE'::text` | 流程狀態 |
| `entry_version_id` | `uuid` | 不可 | `—` | 資料欄位：entry_version_id（語意待與程式碼核對） |
| `reward_version_id` | `uuid` | 不可 | `—` | 資料欄位：reward_version_id（語意待與程式碼核對） |
| `win_version_id` | `uuid` | 不可 | `—` | 資料欄位：win_version_id（語意待與程式碼核對） |
| `risk_version_id` | `uuid` | 不可 | `—` | 資料欄位：risk_version_id（語意待與程式碼核對） |
| `time_version_id` | `uuid` | 不可 | `—` | 事件時間戳 |
| `brain_version_id` | `uuid` | 不可 | `—` | 資料欄位：brain_version_id（語意待與程式碼核對） |
| `diagnostic_version_id` | `uuid` | 可 | `—` | 資料欄位：diagnostic_version_id（語意待與程式碼核對） |
| `evaluation_run_id` | `uuid` | 可 | `—` | 資料欄位：evaluation_run_id（語意待與程式碼核對） |
| `evaluation_metrics` | `jsonb` | 不可 | `'{}'::jsonb` | 整組模型獨立驗證績效 |
| `baseline_bundle_id` | `uuid` | 可 | `—` | 比較基準整組模型 |
| `data_fingerprint` | `text` | 可 | `—` | 訓練資料指紋 |
| `code_revision` | `text` | 可 | `—` | 程式碼版本 |
| `validation_notes` | `text` | 可 | `—` | 資料欄位：validation_notes（語意待與程式碼核對） |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |
| `approved_at` | `timestamp with time zone` | 可 | `—` | 正式批准時間 |

**外鍵關聯：**
- `model_bundles_evaluation_run_id_fkey`：`ai_v2.model_bundles(evaluation_run_id)` → `ai_v2.research_runs(id)`
- `model_bundles_diagnostic_version_id_fkey`：`ai_v2.model_bundles(diagnostic_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_brain_version_id_fkey`：`ai_v2.model_bundles(brain_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_time_version_id_fkey`：`ai_v2.model_bundles(time_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_entry_version_id_fkey`：`ai_v2.model_bundles(entry_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_risk_version_id_fkey`：`ai_v2.model_bundles(risk_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_win_version_id_fkey`：`ai_v2.model_bundles(win_version_id)` → `ai_v2.expert_versions(id)`
- `model_bundles_reward_version_id_fkey`：`ai_v2.model_bundles(reward_version_id)` → `ai_v2.expert_versions(id)`
- `signal_notifications_model_bundle_id_fkey`：`ai_v2.signal_notifications(model_bundle_id)` → `ai_v2.model_bundles(id)`
- `shadow_orders_model_bundle_id_fkey`：`ai_v2.shadow_orders(model_bundle_id)` → `ai_v2.model_bundles(id)`
- `simulated_trades_model_bundle_id_fkey`：`ai_v2.simulated_trades(model_bundle_id)` → `ai_v2.model_bundles(id)`
- `decisions_model_bundle_id_fkey`：`ai_v2.decisions(model_bundle_id)` → `ai_v2.model_bundles(id)`
- `model_bundle_events_previous_bundle_id_fkey`：`ai_v2.model_bundle_events(previous_bundle_id)` → `ai_v2.model_bundles(id)`
- `model_bundle_events_bundle_id_fkey`：`ai_v2.model_bundle_events(bundle_id)` → `ai_v2.model_bundles(id)`
- `active_model_bundle_bundle_id_fkey`：`ai_v2.active_model_bundle(bundle_id)` → `ai_v2.model_bundles(id)`
- `model_bundles_baseline_bundle_id_fkey`：`ai_v2.model_bundles(baseline_bundle_id)` → `ai_v2.model_bundles(id)`

### `ai_v2.active_model_bundle`

**用途：** 正式使用中的單一整組模型版本指標  
**RLS：** 已啟用  
**主鍵：** slot

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `slot` | `text` | 不可 | `—` | 資料欄位：slot（語意待與程式碼核對） |
| `bundle_id` | `uuid` | 不可 | `—` | 資料欄位：bundle_id（語意待與程式碼核對） |
| `activated_at` | `timestamp with time zone` | 不可 | `now()` | 啟用時間 |
| `activation_reason` | `text` | 不可 | `—` | 資料欄位：activation_reason（語意待與程式碼核對） |

**外鍵關聯：**
- `active_model_bundle_bundle_id_fkey`：`ai_v2.active_model_bundle(bundle_id)` → `ai_v2.model_bundles(id)`

### `ai_v2.model_bundle_events`

**用途：** 整組模型建立、驗證、批准、啟用、回退歷史  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `bigint` | 不可 | `—` | 主鍵／唯一識別碼 |
| `bundle_id` | `uuid` | 不可 | `—` | 資料欄位：bundle_id（語意待與程式碼核對） |
| `event_type` | `text` | 不可 | `—` | 事件類別 |
| `previous_bundle_id` | `uuid` | 可 | `—` | 資料欄位：previous_bundle_id（語意待與程式碼核對） |
| `run_id` | `uuid` | 可 | `—` | 關聯研究或訓練輪次 |
| `details` | `jsonb` | 不可 | `'{}'::jsonb` | 資料欄位：details（語意待與程式碼核對） |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |

**外鍵關聯：**
- `model_bundle_events_run_id_fkey`：`ai_v2.model_bundle_events(run_id)` → `ai_v2.research_runs(id)`
- `model_bundle_events_bundle_id_fkey`：`ai_v2.model_bundle_events(bundle_id)` → `ai_v2.model_bundles(id)`
- `model_bundle_events_previous_bundle_id_fkey`：`ai_v2.model_bundle_events(previous_bundle_id)` → `ai_v2.model_bundles(id)`

### `ai_v2.dashboard_settings`

**用途：** 前端管理設定的鍵值儲存  
**RLS：** 已啟用  
**主鍵：** key

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `key` | `text` | 不可 | `—` | 資料欄位：key（語意待與程式碼核對） |
| `value` | `jsonb` | 不可 | `—` | 資料欄位：value（語意待與程式碼核對） |
| `description` | `text` | 可 | `—` | 資料欄位：description（語意待與程式碼核對） |
| `updated_by` | `uuid` | 可 | `—` | 資料欄位：updated_by（語意待與程式碼核對） |
| `updated_at` | `timestamp with time zone` | 不可 | `now()` | 更新時間 |

### `ai_v2.control_requests`

**用途：** 前端訓練、驗證、稽核、回補控制請求  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `action` | `text` | 不可 | `—` | 決策或操作類型 |
| `status` | `text` | 不可 | `'PENDING'::text` | 流程狀態 |
| `parameters` | `jsonb` | 不可 | `'{}'::jsonb` | 資料欄位：parameters（語意待與程式碼核對） |
| `requested_by` | `uuid` | 可 | `—` | 操作申請人 |
| `requested_at` | `timestamp with time zone` | 不可 | `now()` | 事件時間戳 |
| `started_at` | `timestamp with time zone` | 可 | `—` | 事件時間戳 |
| `finished_at` | `timestamp with time zone` | 可 | `—` | 事件時間戳 |
| `result` | `jsonb` | 可 | `—` | 執行結果 |
| `error_message` | `text` | 可 | `—` | 錯誤訊息 |

### `ai_v2.admin_audit_log`

**用途：** 管理員操作稽核與前後值  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `bigint` | 不可 | `—` | 主鍵／唯一識別碼 |
| `actor_id` | `uuid` | 可 | `—` | 操作人 |
| `action` | `text` | 不可 | `—` | 決策或操作類型 |
| `entity_type` | `text` | 不可 | `—` | 資料欄位：entity_type（語意待與程式碼核對） |
| `entity_id` | `text` | 可 | `—` | 資料欄位：entity_id（語意待與程式碼核對） |
| `old_value` | `jsonb` | 可 | `—` | 資料欄位：old_value（語意待與程式碼核對） |
| `new_value` | `jsonb` | 可 | `—` | 資料欄位：new_value（語意待與程式碼核對） |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |

### `ai_v2.notification_preferences`

**用途：** 使用者 WEB／LINE 通知偏好  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `user_id` | `uuid` | 不可 | `—` | 使用者識別碼 |
| `channel` | `text` | 不可 | `—` | WEB 或 LINE 通知管道 |
| `enabled` | `boolean` | 不可 | `false` | 啟用狀態 |
| `event_types` | `ARRAY` | 不可 | `'{}'::text[]` | 資料欄位：event_types（語意待與程式碼核對） |
| `settings` | `jsonb` | 不可 | `'{}'::jsonb` | 設定 JSON |
| `updated_at` | `timestamp with time zone` | 不可 | `now()` | 更新時間 |

### `ai_v2.sim_accounts`

**用途：** 每個研究輪次單一初始 10,000 元的模擬帳戶  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `run_id` | `uuid` | 不可 | `—` | 關聯研究或訓練輪次 |
| `initial_capital` | `numeric` | 不可 | `10000` | 初始模擬本金 |
| `currency_code` | `text` | 可 | `—` | 模擬本金幣別（尚待確認） |
| `realized_pnl` | `numeric` | 不可 | `0` | 已實現損益 |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |

**外鍵關聯：**
- `sim_accounts_run_id_fkey`：`ai_v2.sim_accounts(run_id)` → `ai_v2.research_runs(id)`
- `sim_positions_account_id_fkey`：`ai_v2.sim_positions(account_id)` → `ai_v2.sim_accounts(id)`
- `sim_account_events_account_id_fkey`：`ai_v2.sim_account_events(account_id)` → `ai_v2.sim_accounts(id)`
- `simulated_trades_account_id_fkey`：`ai_v2.simulated_trades(account_id)` → `ai_v2.sim_accounts(id)`

### `ai_v2.sim_positions`

**用途：** 模擬待成交／持倉及資金預留；觸發器限制合計 80% 與同商品同週期區間重疊  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `account_id` | `uuid` | 不可 | `—` | 模擬帳戶識別碼 |
| `decision_id` | `uuid` | 不可 | `—` | 關聯決策紀錄 |
| `symbol` | `text` | 不可 | `—` | 交易對代碼 |
| `timeframe` | `text` | 不可 | `—` | K 線週期 |
| `direction` | `text` | 不可 | `—` | LONG／SHORT 方向 |
| `entry_low` | `numeric` | 不可 | `—` | 預計進場區間下界 |
| `entry_high` | `numeric` | 不可 | `—` | 預計進場區間上界 |
| `reserved_capital` | `numeric` | 不可 | `—` | 預留／占用資金 |
| `status` | `text` | 不可 | `'PENDING'::text` | 流程狀態 |
| `entry_open_time` | `bigint` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `exit_open_time` | `bigint` | 可 | `—` | 行情價格／時間或其衍生數值 |
| `realized_pnl` | `numeric` | 不可 | `0` | 已實現損益 |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |

**外鍵關聯：**
- `sim_positions_account_id_fkey`：`ai_v2.sim_positions(account_id)` → `ai_v2.sim_accounts(id)`
- `sim_positions_decision_id_fkey`：`ai_v2.sim_positions(decision_id)` → `ai_v2.decisions(id)`
- `sim_account_events_position_id_fkey`：`ai_v2.sim_account_events(position_id)` → `ai_v2.sim_positions(id)`
- `simulated_trades_position_id_fkey`：`ai_v2.simulated_trades(position_id)` → `ai_v2.sim_positions(id)`

### `ai_v2.sim_account_events`

**用途：** 模擬帳戶資金占用、釋放、成交、費用及調整流水  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `bigint` | 不可 | `—` | 主鍵／唯一識別碼 |
| `account_id` | `uuid` | 不可 | `—` | 模擬帳戶識別碼 |
| `position_id` | `uuid` | 可 | `—` | 模擬持倉識別碼 |
| `event_type` | `text` | 不可 | `—` | 事件類別 |
| `amount` | `numeric` | 不可 | `—` | 資料欄位：amount（語意待與程式碼核對） |
| `equity_after` | `numeric` | 可 | `—` | 資料欄位：equity_after（語意待與程式碼核對） |
| `details` | `jsonb` | 不可 | `'{}'::jsonb` | 資料欄位：details（語意待與程式碼核對） |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |

**外鍵關聯：**
- `sim_account_events_position_id_fkey`：`ai_v2.sim_account_events(position_id)` → `ai_v2.sim_positions(id)`
- `sim_account_events_account_id_fkey`：`ai_v2.sim_account_events(account_id)` → `ai_v2.sim_accounts(id)`

### `ai_v2.expert_reviews`

**用途：** 五專家與 Brain 各版本逐級審查、RETURN 與理由快照  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `decision_id` | `uuid` | 不可 | `—` | 關聯決策紀錄 |
| `revision` | `integer` | 不可 | `—` | 資料欄位：revision（語意待與程式碼核對） |
| `step` | `integer` | 不可 | `—` | 資料欄位：step（語意待與程式碼核對） |
| `role` | `text` | 不可 | `—` | 專家角色 |
| `expert_version_id` | `uuid` | 可 | `—` | 資料欄位：expert_version_id（語意待與程式碼核對） |
| `action` | `text` | 不可 | `—` | 決策或操作類型 |
| `input_snapshot` | `jsonb` | 不可 | `—` | 本階段專家輸入快照 |
| `output_snapshot` | `jsonb` | 不可 | `—` | 本階段專家輸出快照 |
| `reason` | `jsonb` | 不可 | `'{}'::jsonb` | 決策理由 |
| `returned_to_role` | `text` | 可 | `—` | 資料欄位：returned_to_role（語意待與程式碼核對） |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |

**外鍵關聯：**
- `expert_reviews_expert_version_id_fkey`：`ai_v2.expert_reviews(expert_version_id)` → `ai_v2.expert_versions(id)`
- `expert_reviews_decision_id_fkey`：`ai_v2.expert_reviews(decision_id)` → `ai_v2.decisions(id)`

### `ai_v2.diagnostic_attributions`

**用途：** 診斷對各專家的主要／次要責任、決策品質及學習回饋  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `diagnosis_id` | `uuid` | 不可 | `—` | 關聯診斷 |
| `role` | `text` | 不可 | `—` | 專家角色 |
| `responsibility` | `text` | 不可 | `—` | 主要／次要／無責任 |
| `decision_quality` | `text` | 不可 | `—` | 決策品質 |
| `evidence` | `jsonb` | 不可 | `'{}'::jsonb` | 診斷或反事實評估依據 |
| `feedback` | `jsonb` | 不可 | `'{}'::jsonb` | 學習回饋內容 |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |

**外鍵關聯：**
- `diagnostic_attributions_diagnosis_id_fkey`：`ai_v2.diagnostic_attributions(diagnosis_id)` → `ai_v2.diagnostics(id)`

### `ai_v2.signal_notifications`

**用途：** WEB／LINE 訊號快照、有效性檢查、抑制原因與送達狀態  
**RLS：** 已啟用  
**主鍵：** id

| 欄位 | 型別 | NULL | 預設值 | 說明 |
|---|---|---|---|---|
| `id` | `uuid` | 不可 | `gen_random_uuid()` | 主鍵／唯一識別碼 |
| `decision_id` | `uuid` | 不可 | `—` | 關聯決策紀錄 |
| `model_bundle_id` | `uuid` | 可 | `—` | 使用的整組模型版本 |
| `channel` | `text` | 不可 | `—` | WEB 或 LINE 通知管道 |
| `status` | `text` | 不可 | `'PENDING'::text` | 流程狀態 |
| `signal_snapshot` | `jsonb` | 不可 | `—` | 送出前固定的完整建議快照 |
| `validity_check` | `jsonb` | 可 | `—` | 發送前有效性檢查結果 |
| `suppressed_reason` | `text` | 可 | `—` | 資料欄位：suppressed_reason（語意待與程式碼核對） |
| `created_at` | `timestamp with time zone` | 不可 | `now()` | 建立時間 |
| `sent_at` | `timestamp with time zone` | 可 | `—` | 事件時間戳 |

**外鍵關聯：**
- `signal_notifications_decision_id_fkey`：`ai_v2.signal_notifications(decision_id)` → `ai_v2.decisions(id)`
- `signal_notifications_model_bundle_id_fkey`：`ai_v2.signal_notifications(model_bundle_id)` → `ai_v2.model_bundles(id)`

## 第三部分：重要約束與驗收狀態

- 模擬帳戶以單一研究輪次建立，初始本金 10,000；幣別尚待工程確認。
- `ai_v2.sim_positions` 已建立資料庫觸發器，對 PENDING/OPEN 的預留資金合計檢查 80% 上限及同商品／週期進場區間重疊。仍需實際並行、結算及虧損測試。
- `ai_v2.model_bundles` 檢查各版本角色；`ai_v2.active_model_bundle` 限制只啟用已批准且有驗證輪次的整組模型。完整晉升統計、回退與端到端測試尚未完成。
- `ai_v2.shadow_orders` 的反事實損益不得混入 `simulated_trades` 已實現損益；此為規格約束，尚待程式測試。
- `ai_v2.expert_reviews` 保存各階段快照，仍需驗證 Entry/Reward/Win/Risk/Time/Brain 欄位所有權與 RETURN 流程。
- 新 AI V2 表已啟用 RLS；前端使用者角色、政策、API 授權尚未驗收。不得把 service_role 金鑰暴露於瀏覽器。
- 舊 `ai_v2.champions` 仍存在供相容與追溯，不能把單一專家 Champion 視為正式整組版本。
- 不包含任何真實帳戶、真實持倉、自動真實下單結構。

## 第四部分：備份邊界與後續維護

1. 本檔為 2026-10-17 時點的**文件快照**；往後遷移需同步更新資料字典，並保留 Git commit 追溯。
2. 若需完整災難復原，另須定期建立 Supabase 正式資料備份、結構 SQL migration、模型產物及安全保存的設定；不可把本 Markdown 當成實際資料備份。
3. 規劃書優先序以第一部分正式主規劃為準；資料庫結構只表示已建立，不代表 AI、前端或技術指標程序已運行。


---

# 第五部分：2026-10-17 最新專案進度與交接快照

> 本節為追加進度快照，優先於前面 2026-10-17 原始備份中的舊進度描述；原始規劃及資料字典保留供追溯。以下「通過」分為實測通過及使用者接受免測，不混用。此為文件備份，不是資料庫 dump。

## 1. 現階段總覽

- **目前階段：P0 資料庫與資料品質驗收，尚未正式封版。**
- **P0.1 資料庫結構與安全：部分完成，待最後權限核對。**
- **P0.2 原始行情資料：基本通過，待最新收盤邊界與 Binance 官方抽樣。**
- **P0.3 技術指標：依使用者最新驗收範圍，標記通過。**
- **P0.4 資料抓取與回補：使用者明確決定標記通過，免除新版部署後剩餘實測；此為使用者接受，不等於每項技術驗證均已取得證據。**
- **P1 前端控制中心：尚未開始本輪正式開發；P2～P7 依 V2 計畫待後續實作。** 現有資料表與舊程式不等於 V2 五專家、Brain、診斷 AI 已完成。

## 2. P0.1 已完成與剩餘

- Supabase 專案 `xqtsmrzxixkecvaovzfy`，`public` 5 表、`ai_v2` 20 表，合計 25 表；已確認 RLS 啟用。
- 三個 `public` SECURITY DEFINER 管理 RPC：`authenticated` 具有 EXECUTE、`anon` 無 EXECUTE；函式有 `auth.uid()` 及 `app_user_roles` 管理員檢查。仍需以非管理員身分執行負向權限測試及完成角色矩陣。
- 實測拒絕未批准模型啟用、拒絕不存在帳戶持倉；以隔離測試確認 10,000 本金預留 8,001 遭 80% 限制拒絕、預留 5,000 可成功、同商品同週期重疊進場區間遭拒絕；測試資料回滾，`P0_TEST` research_runs 無殘留。
- 安全顧問提醒：23 張表無 RLS policy（可能是預設拒絕）、Auth leaked-password protection 未啟用；效能顧問提醒 28 個未覆蓋索引外鍵，需按實際用途評估，不應直接當作已遭入侵或立即全部修正。

## 3. P0.2 已完成與剩餘

- 7 個 Binance Spot 交易對：BTCUSDT、ETHUSDT、SOLUSDT、BNBUSDT、XRPUSDT、DOGEUSDT、PENGUUSDT；各 15m、1h、4h、1d，共 28 組，目標回補 3 年。
- 28/28 組原始 K 線相鄰 `open_time` 檢查缺口 0；OHLC 邏輯違規 0；`data_quality_issues` 未解決 0。原生週期抓取，不使用 5m 聚合。
- 仍待核對最新已收盤 K 線時間邊界，以及抽樣比對 Binance 官方來源；不能把 28 組內部連續性等同外部行情一致性全部驗收。

## 4. P0.3 技術指標使用者最新決定（必須沿用）

**所有技術指標都由本系統保存的原始 K 線資料自行計算產生，不需要再逐項驗證指標公式或重算數值；不得將這種重複驗證列為 P0 封版或後續開發前置條件。** 只確認指標正常產生、與原始 K 線時間對齊、完整且無缺漏；若日後出現具體異常再針對異常排查。

- 28 組 `market_features` 均存在；對應原始 K 線鍵值無孤兒特徵、`sma_200` NULL 0；每組最早 200 根原始 K 線不產生特徵，符合暖機設計。
- 已做過部分 SMA、EMA、布林抽樣重算，但**不再要求 MACD、RSI、ATR、KDJ 等公式獨立重算**。
- P0.3 狀態：**通過（依最新使用者驗收規則）**。

## 5. P0.4 任務生命週期、部署與使用者接受

- GitHub `collector.py` 新增異常 `RUNNING` 任務恢復：啟動時及約每小時檢查超過 24 小時的任務，排除本進程仍活躍 ID，以條件式 PATCH 將中斷殘留任務標為 `FAILED`，記錄 `AUTO_RECOVERY`。24 小時期限屬保守設定；不表示每個異常都能立即結案。
- 曾人工結案 22 筆 Railway 重啟前殘留任務；之後查詢 `ingestion_jobs` 得 `SUCCEEDED=1919`、`FAILED=30`、`RUNNING=0`，超過 24 小時仍 RUNNING 0。30 筆失敗包含早期 451 及重啟中斷歷史，不等於 30 個當前故障。
- 每 15 分鐘抓最新已收盤 100 根、每日台北時間 09:00 後深度回補、新商品初始回補；`Procfile` 執行 `worker.py`，成功抓取後接續計算特徵。
- 2026-10-17 已修正 `collector.py` 明確回傳抓取成功／失敗（commit `6ede8c5`），`worker.py` 僅於成功抓取後執行特徵同步（commit `d4f6f06`）。
- Railway 專案 `1b703a9c-07fb-48ca-a5e5-def4c9531e34`，production `9a3043a4-3585-4742-8cf4-f9a3674fd286`，`native-candle-collector` 服務 `b8258611-9cbb-4588-88f7-d44e3477d6bc`。修正提交後最後一次查詢時新版部署為 `BUILDING`，先前版本 `SUCCESS`；**未取得新版部署完成及後續定時同步的證據**。
- 使用者明確指示「不用，標記通過吧」，故 **P0.4 記為通過（使用者免除剩餘實測）**，不應再要求以部署實測作為此階段的封版門檻。

## 6. 進度文件與下一步

- 現行需求：`docs/V2_MASTER_PLAN_2026-10-17.md`。
- 開發階段：`docs/V2_MASTER_PLAN_WITH_DEVELOPMENT_PHASES_2026-10-17.md`（P0～P7，共 45 小階段）。
- P0 詳細驗收及歷史證據：`docs/P0_AUDIT_PROGRESS_2026-10-17.md`。
- 本文件為**規劃書＋資料字典＋最新進度**的集中備份，包含最新使用者決策，但資料字典仍是建立當時的結構快照，不保證與後續所有 migration 即時同步。
- **下一步：完成 P0.1 非管理員權限與角色矩陣核對、P0.2 最新已收盤與官方抽樣；之後 P0 封版，進入 P1 前端控制中心。** 不重複驗證技術指標公式，也不恢復自動真實下單。
