# AI 交易系統 V2｜專案總入口與新對話交接

> 最後整理：2026-10-17（P0 使用者封版，P1 啟動）。這是**導航與交接文件**，不取代正式需求或即時驗收；「文件記載」不等於現場重新驗證。每次交接請先讀本檔，再依下列連結讀取來源，並核對 GitHub/Supabase/Railway 現況。

## 一、四個資訊區塊（權威來源）

| 區塊 | 正式文件 | 內容 |
|---|---|---|
| 01 正式規劃書 | [V2_MASTER_PLAN_2026-10-17.md](docs/V2_MASTER_PLAN_2026-10-17.md) | 15 章已確認需求；衝突以使用者最新明確決定優先 |
| 02 資料庫字典 | [V2_MASTER_PLAN_AND_DATABASE_DICTIONARY_BACKUP_2026-10-17.md](docs/V2_MASTER_PLAN_AND_DATABASE_DICTIONARY_BACKUP_2026-10-17.md) | 2026-10-17 的 Supabase 25 表欄位快照；不是即時 DB，也不是資料備份 |
| 03 開發階段大綱 | [V2_MASTER_PLAN_WITH_DEVELOPMENT_PHASES_2026-10-17.md](docs/V2_MASTER_PLAN_WITH_DEVELOPMENT_PHASES_2026-10-17.md) | P0～P7，8 大階段、45 小階段；含正式主規劃原文 |
| 04 目前進度 | [P0_AUDIT_PROGRESS_2026-10-17.md](docs/P0_AUDIT_PROGRESS_2026-10-17.md) 與本檔第四節 | P0 已依使用者決定封版，P1 啟動；保留未實測風險 |

**注意**：P0_AUDIT_PROGRESS 保留早期未完成項目；若與集中備份第五部分 2026-10-17 最新使用者決定衝突，優先採用後者。未來應在本檔更新「最新進度」，避免只靠聊天記憶。

## 二、專案定位與不可違反規則

- 私人 AI 交易研究／決策顧問。**僅產生交易建議，由使用者手動下單**；不得自動真實交易、連接或管理真實帳戶，也不追蹤真實持倉。
- 市場資料：Binance 官方已收盤原生 K 線，15m、1h、4h、1d；禁止用 5m 合成。原始行情與衍生指標分離，AI 不得修改原始資料。
- 初期七商品：BTCUSDT、ETHUSDT、SOLUSDT、BNBUSDT、XRPUSDT、DOGEUSDT、PENGUUSDT；約三年回補，15 分鐘最新 100 根、台北 09:00 深度回補。
- 五專家按順序：Entry（方向／進場／週期）、Reward（TP/SL/RR）、Win Probability（勝率／正期望）、Risk/Position（倉位／風險）、Time（持有時間）；Brain 整合後 APPROVE／RETURN／REJECT／WAIT。各專家不得擅自覆寫前一專家的責任欄位。
- 模擬：單一帳戶，初始 10,000（幣別待定）、無槓桿；**所有同時持倉合計**資金占用不得超過當下帳戶資金 80%；同商品＋同週期未結束交易的進場區間不可重疊。
- 只用當時已知收盤資料決策，決策根不得成交；未進場先觸及 TP/SL 就取消掛單；同根 TP/SL 同時觸及以收盤價距離判斷，等距算 SL；未成交影子單不得計入已實現損益。
- 獨立、自主學習診斷 AI：診斷所有已結算盈虧交易、影子單及 WAIT／RETURN，先判斷決策品質與主要／次要責任再回饋；不能只按盈虧獎懲。
- 24 個月時間序列逐根重播，可約 100 輪真正有模型更新的迭代；Champion／Challenger 獨立比較，整組驗證通過才晉升；不能偷看未來。BTC 經驗可跨加密商品共享，但保留商品差異。
- **已撤銷**：舊四固定策略／四資金池、固定 0～100 評分、固定勝率／年化門檻、強制 30 天 Embargo、16+4 月舊訓練流程、自動真實下單、5m 合成、單筆 80% 的錯誤理解。
- **待工程定義**：模擬幣別、費率與滑價、SHORT 成本、撮合細則、影子單觀察窗、模型晉升標準、前端角色矩陣等；不得宣稱已獲使用者確認。

## 三、開發階段（8 大／45 小）

- **P0 資料庫與資料品質（4）**：P0.1 結構與安全；P0.2 原始行情；P0.3 技術指標；P0.4 抓取回補。
- **P1 前端控制中心（6）**：登入權限、總覽、商品資料、訓練控制、專家模型、通知設定。
- **P2 歷史模擬（6）**：帳戶、重播、撮合、影子單、績效、驗收。
- **P3 五專家（7）**：共用資料、Entry、Reward、Win、Risk、Time、整合驗收。
- **P4 Brain（5）**：協作、決策、RETURN/WAIT、完整建議、驗收。
- **P5 診斷與自主學習（6）**：獨立診斷、交易／影子單、WAIT、歸因、迭代、驗收。
- **P6 模型驗證與版本（5）**：獨立驗證、Champion/Challenger、整組驗證、晉升回退、成果驗收。
- **P7 市場監測通知（6）**：最新行情、正式決策、訊號有效性、前端、LINE、整合驗收。

## 四、目前進度（2026-10-17 使用者最新決定）

**P0：已完成／已封版（使用者接受驗收）**。P0.1、P0.2 先前尚未完成的非管理員負向權限測試、前端角色矩陣、官方 K 線抽樣及最新收盤邊界核對，**由使用者接受剩餘風險，不代表已通過全部技術測試**。P0.3 先前已依使用者決定通過；P0.4 先前已接受免除剩餘部署實測。歷史紀錄保留於 P0 驗收檔，後續若發現具體安全或資料問題應列 P1 風險修復，不重新把 P0 標為未完成。

**目前階段：P1 前端控制中心（啟動，尚未宣稱程式完成）**。

**P1 使用者確認視覺與裝置要求**：
- 深色系，簡約、科技感；所有介面**繁體中文**，英語專有名詞應翻譯為中文，必要時僅於輔助說明保留原文。
- 使用者於 2026-10-17 提供黑色幾何馬頭及 UBER 字樣 Logo；**必須完整使用原始圖形及字樣**，禁止重繪、裁切、變形、拆解或改變構圖；只允許更換顏色。原始圖片目前來自聊天附件，**尚未核實已納入 GitHub 資產**，前端不可擅用相似馬頭替代。
- 響應式網頁設計（RWD），以 iOS Safari／iPhone 的觸控操作、窄螢幕、安全區、字級與導覽優先；桌面版同步支援。
- P1.1 登入權限、P1.2 總覽、P1.3 商品資料、P1.4 訓練控制、P1.5 專家模型、P1.6 設定通知；未完成的 AI 功能須標示尚未啟用。
- 詳見 [P1_FRONTEND_DESIGN_SPEC_2026-10-17.md](docs/P1_FRONTEND_DESIGN_SPEC_2026-10-17.md)。

**P1 進度更新（2026-10-17）**：已提交 `frontend/index.html`、`main.js`、`styles.css`、`login.css`、`auth.js`、`config.js`、`data.js` 及 `README.md`。已具備繁體中文深色響應式介面、Supabase 電郵密碼驗證程式基礎、登入關閉式保護，以及原生行情只讀查詢。**尚未完成管理員身分綁定、公開金鑰配置、原始 Logo GitHub 資產、實際登入驗收、iPhone Safari 實測及 Railway 前端部署。**使用者指定管理員登入名稱 `guber`，密碼不得寫入任何 GitHub 文件、程式或部署變數明文。Supabase Auth 需確認可登入的電子郵件及管理員角色。\n\n**現場查核**：Supabase `public` 5 表與 `ai_v2` 20 表仍存在；`raw_candles` 目前有已登入者 SELECT policy，Railway `native-candle-collector` 最新部署為 SUCCESS（2026-10-16T23:51:34Z），但前端服務尚未建立。\n\n**下一步**：完成管理員電子郵件／權限綁定、設定安全公開金鑰、實測行情只讀資料、加入完整原始 Logo、驗收 iOS Safari，再獨立部署前端；不可影響現有抓取服務。

**環境參考**：GitHub `jacklin79315/guber-ai-market-data-system` (`main`)；Supabase `xqtsmrzxixkecvaovzfy`（`public`、`ai_v2`）；Railway `1b703a9c-07fb-48ca-a5e5-def4c9531e34`（`native-candle-collector`）。

## 五、新對話交接指令

在新對話貼上：

> 請接手我的 AI 交易系統 V2。GitHub 倉庫是 jacklin79315/guber-ai-market-data-system。先讀取根目錄 PROJECT_HANDOFF.md，再依其中連結讀取正式規劃書、資料庫字典、P0～P7 階段大綱及最新進度。核對最新 GitHub commit 與可用的 Supabase、Railway 現況，列出已確認需求、實際完成、待驗證及下一步。以最新明確使用者決定為最高優先，禁止恢復已撤銷規格；不要把文件聲稱完成當成實際驗證。若無需我授權，請從當前階段繼續執行。

## 六、維護規則（避免下次再次分散）

1. **需求變更**：更新正式主規劃對應章節，並檢查階段規劃是否需同步。
2. **資料庫 schema 變更**：更新資料字典並標註快照時間；不以文件取代實際 migration／備份。
3. **階段完成或驗收**：更新 P0_AUDIT_PROGRESS（或未來相應 Pn 進度檔）及本檔「目前進度」；附 commit／測試／部署證據。
4. **新對話**：先讀本檔，再讀四類來源，確認最新 commit；避免僅憑對話記憶。
5. **禁止假完成**：清楚區分「規劃已確認」「程式已寫」「測試已通過」「使用者接受免測」「正式部署已驗證」。



### P1 持續開發紀錄（2026-10-17）
- 管理員登入方式確認為帳號 `guber`＋密碼，不要求個人電子郵件；密碼禁止寫入版本庫與部署設定。已建立 `frontend/server.mjs` Node 後端驗證入口、`frontend/package.json`，改用帳號登入，內部 Supabase Auth 身分別名由後端環境變數管理。
- 已補強登入／會話更新／身分查詢皆需符合管理員內部身分 ID 與內部別名，缺少必要設定時拒絕登入。
- 已建立後端受保護的原生 K 線唯讀代理 `/api/data/candles`，每次查詢先核對管理員登入狀態，限制商品及週期；前端 `data.js` 改走該代理。
- Railway 新增獨立服務 `uber-v2-control-center`（ID `bf479074-7963-4ece-9e68-bcb4736f7b3b`），來源 main、根目錄 `/frontend`、啟動 `npm start`、健康檢查 `/api/health`。首次部署已觸發，當時狀態 BUILDING，**不可宣稱已部署成功**。
- 新服務已設定 Supabase URL、公開金鑰與管理員帳號名稱；**管理員內部 Auth 身分尚未開通／設定，未填入 `ADMIN_AUTH_EMAIL` 與 `ADMIN_AUTH_USER_ID`，登入會拒絕服務**。不得使用現有未知使用者身分冒充管理員。
- Logo 原始 JPEG 已在對話工作環境保留，GitHub 資產尚未上傳；不可替代圖形。原行情抓取服務未更動。


### P1 前端部署與安全測試（2026-10-17）
- Railway `uber-v2-control-center` 服務部署狀態 **SUCCESS**，執行紀錄確認 `Frontend listening on 8080`。獨立公開網域：`https://uber-v2-control-center-production.up.railway.app`；**尚未完成外部 HTTP 實測與管理員登入驗收**。
- 已補上 `/api/health` 健康檢查、管理員身分 ID 驗證、受保護的 `/api/data/candles` 只讀行情代理。管理員未配置時登入／行情接口應拒絕請求。
- 已加入 `frontend/server.test.mjs` 安全冒煙測試與 `.github/workflows/p1-frontend-tests.yml` 自動測試工作流程，待 GitHub Actions 執行結果確認，**不可宣稱測試通過**。
- 已封鎖直接讀取伺服器 `.mjs` 程式及套件中繼資料。Logo 圖檔仍待 GitHub 上傳。


### P1 新增資料品質頁（2026-10-17）
- `frontend/main.js` 已加入 BTCUSDT 15m/1h/4h/1d 最近已收盤 K 線時間檢查，畫面以台北時間顯示並標示可能延遲；**僅代表最新資料時效，不代表全歷史缺漏或技術指標檢驗**。
- `frontend/server.mjs` 已加入登入嘗試速率限制、行情唯讀 GET 方法限制、前端安全回應標頭；需待 CI 與實際部署驗證。
- 管理員 Auth 內部身分仍未開通，`ADMIN_AUTH_EMAIL`/`ADMIN_AUTH_USER_ID` 尚未配置，無法正式登入。原始 Logo 二進位資產仍待上傳。


### P1 真實資料對接修正（2026-10-17）
- 查核 Supabase `raw_candles` BTCUSDT 四個週期均有原始資料（15m、1h、4h、1d）；`close_time` 為毫秒 Unix timestamp（bigint），已修正前端時間解析，避免誤判日期格式異常。
- 新增受管理員登入驗證保護的唯讀 `/api/data/watchlist` 及前端 `fetchWatchlist()`；商品監測頁開始顯示資料庫清單總數與啟用數（待登入實測）。
- 擴充 `frontend/server.test.mjs`，涵蓋禁止 POST 行情查詢、封鎖伺服器程式碼與未配置管理員時拒絕讀取清單；測試仍需核對 GitHub Actions 結果。
- Railway 前端已有 SUCCESS 部署紀錄，但最新提交持續自動部署，應以最新 commit SHA 對照狀態。管理員身份仍未建立，勿宣稱登入或行情實測成功。
