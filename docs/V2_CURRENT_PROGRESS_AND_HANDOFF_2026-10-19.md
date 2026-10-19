# AI 交易系統 V2｜2026-10-19 最新開發進度與接手指引

> 本文件為 **2026-10-19 台北時間**之交接快照；GitHub、CI、Supabase 現況已於撰寫時查核。**它是進度記錄，不取代正式規劃書。** 新對話須再次查最新 main、CI、資料庫、Railway；不應把歷史快照當即時狀態。

## 0. 權威來源與衝突規則
1. **唯一現行需求規格**：[`V2_MASTER_PLAN_2026-10-17.md`](V2_MASTER_PLAN_2026-10-17.md)，尤其 §§5、7、8、9、11、13AG、13AL、13AM。檔名日期較舊，但其內容已更新至 10/19 研究要求；請讀全文、特別是後段增補。
2. **最新工程進度**：本檔。根目錄 [`PROJECT_HANDOFF.md`](../PROJECT_HANDOFF.md) 為入口；其 10/17 的 P1 快照已過時，以本檔的最新研究進度為準。
3. **原始資料字典快照**：[`V2_MASTER_PLAN_AND_DATABASE_DICTIONARY_BACKUP_2026-10-17.md`](V2_MASTER_PLAN_AND_DATABASE_DICTIONARY_BACKUP_2026-10-17.md)；它只含 10/17 的 25 表，**不能視為 10/19 全部表**。最新 P4 新增表見本檔 §4，須再查 Supabase `information_schema`。
4. **階段大綱**：[`V2_MASTER_PLAN_WITH_DEVELOPMENT_PHASES_2026-10-17.md`](V2_MASTER_PLAN_WITH_DEVELOPMENT_PHASES_2026-10-17.md)，P0～P7、45 小階段。歷史 `V2_HANDOFF_STATUS_2026-10-17.md` 與 P0 驗收檔保留作時間快照，不可拿來覆蓋本檔。
5. **使用者最新明確決定 > 規劃書舊段落 > 助理建議 > 記憶摘要**。若記憶與 GitHub 規劃書不符，**不要用記憶推翻規劃書**。需求、實作、測試、歷史證據、正式啟用須分別敘述。

## 1. 絕不可違反的設計
- **絕對禁止程式自行真實下單**。系統只研究、訓練、模擬、診斷、產生交易建議；使用者自行手動操作。不得讀寫真實帳戶、管理真實持倉、啟用實盤交易。
- 五專家按 Entry → Reward → Win Probability → Risk/Position → Time，Brain 決定 APPROVE/RETURN/REJECT/WAIT；專家欄位所有權不可錯置。**expectedValue 由 Win 擁有，不是 Reward**。
- 單一模擬帳戶、無槓桿；同時持倉資金占用合計最多 80%，不是單筆 80%；原生已收盤 15m/1h/4h/1d K 線，不以 5m 合成。
- 僅用決策當下已知資料；當根不能成交；未入場先碰 TP/SL 取消；同根 TP/SL 按收盤距離判定、等距 SL；WAIT、RETURN、未成交影子單亦診斷。
- 診斷**先獨立歸因決策品質，再回饋**；合理虧損不自動扣分、碰巧獲利不自動加分；不恢復舊四固定策略、四資金池、0～100 固定評分或 16+4 月切割。
- §13AM 雙層學習：第一層由診斷驅動參數／規則 Challenger；第二層在因果證據充分時研究專家可靠度及 Brain 採納權重；整組須通過**未參與選參的獨立 OOS** 才能受控晉升。現在尚未證明模型進化，不可說已自主調整正式模型。

## 2. 目前真實進度與驗證結果
**當前工作焦點：P4 研究與 P5 診斷／自主學習、P6 驗證的研究實作；不是 10/17 的「剛啟動 P1」**。P0 使用者已接受封版；P1 網站及測試已開發，不能據此推斷 P1～P7 每一小階段皆正式驗收。P2/P3/P4 有模擬及五專家研究程式，但不得將研究原型視為正式模型已驗收。

### A. 自主參數研究（已真實執行，**未證明 OOS 提升**）
- BTCUSDT 1h、每輪 2,000 根歷史 K 線，四輪 GitHub Actions：A `39168610603`、B `39168916746`、C `39170646503`、D `39171112649`；資料存 Supabase P4 研究表。
- entryLookback 20→19、20→21 無提升；entryThreshold 0.001→0.0009 變差，→0.0011 訓練期淨損益相較基準改善約 **6.7427 USDT**，但 **OOS delta=0 / NO_OOS_IMPROVEMENT**。不更新正式模型、不晉升 Champion。
- 第五輪 E `39172104109` 因 `NO_UNTESTED_DIAGNOSTIC_ARMS` 在讀行情前停止；**不是新的歷史訓練結果**。不可重複無新假設的研究臂來冒充學習。

### B. 24 個月 BTC 歷史診斷（**成功執行**）
- 既有不可變研究 job `p4_btc_24m_accept_20261018`、iteration=1；Champion 254 chunks、Challenger 201 chunks，均含分片。透過 SHA256 驗證、重建，各 **1,246 筆**（不是未重建的 1,227／1,231 筆）。
- Champion：CLOSED 118、SHADOW 19、WAIT 1,109、RETURN 0。
- Challenger：CLOSED 119、SHADOW 15、WAIT 1,112、RETURN 0。
- **Risk 新增可驗證 WAIT 歸因**：Champion 1,109、Challenger 1,112，共 2,221；僅證明記錄的 `NON_POSITIVE_EXPECTANCY` WAIT 與當時負 EV 一致，不代表預測成功。
- 最新重新評估後 Risk SOUND：Champion **1,227**、Challenger **1,231**，Risk FAULT **0**。其他 Entry/Reward/Win/Time/Brain 均 **0 項可歸因**，不可虛構正確率。六專家完整審查 **0/1,246、0/1,246**，所有紀錄仍 unresolved。
- 最新缺口：Champion Entry/Reward/Win/Time/Brain 各缺 1,246、Risk 缺 19；Challenger Entry/Reward/Win/Time/Brain 各缺 1,246、Risk 缺 15。缺歸因不等於專家錯誤；要蒐集當時證據與反事實。
- 成功完整歷史 CI [`39179181332`](https://github.com/jacklin79315/guber-ai-market-data-system/actions/runs/39179181332)（`ff648444`）；單元 CI [`39179193143`](https://github.com/jacklin79315/guber-ai-market-data-system/actions/runs/39179193143)（`083f97ba`）。截至此快照兩者 SUCCESS。
- 診斷是**唯讀重新評估**，未覆寫歷史 artifacts、未套用模型權重、未下單、未晉升 Champion。SOUND 僅限特定安全規則，**不可當成完整決策品質**。

### C. 最近程式修改
- `frontend/p4-rule-diagnostician.mjs`：Risk WAIT 負 EV 規則、Brain 安全 veto、進場區間/時間/勝率/期望值不變條件；修正 **Win 擁有 expectedValue**，commit `3360bf79`，測試 `ac2effab`。
- `frontend/p4-diagnostic-evidence.mjs`：保留 SHADOW 決策時風險證據、拒絕重複決策 ID。
- `frontend/p4-expert-reliability-research.mjs`：六角色、WAIT/SHADOW/CLOSED 分類可靠度研究，尚不產生正式權重。
- `frontend/p4-persisted-diagnostic-reassessment.mjs`：唯讀重新評估、每角色 SOUND/FAULT/UNKNOWN、缺失歸因統計。
- `frontend/p4-autonomous-diagnostic-research.mjs`：整合完整重建後的研究結果；`frontend/p4-existing-diagnostic-reassessment-runner.mjs`：真實讀取 Supabase、SHA256 校驗、分片重建。
- `.github/workflows/p4-existing-diagnostic-reassessment.yml`：診斷邏輯修改時自動觸發唯讀歷史重評；不可變 artifacts 不回寫。
- 最新已驗證提交 `083f97bab93e`（測試成功）。交接時重新查 `main`，勿假定 SHA 永久是 HEAD。

## 3. 下一步（接手後直接執行，不要重做舊測試）
1. 先讀完規劃書 §13AM 與本檔，核對 GitHub HEAD、兩個最新 CI、Supabase P4 artifacts/rounds；確認工作沒有被其他對話更新。
2. **優先改善診斷證據的因果品質**，從有明確可核對的決策時證據開始：Entry 的成交／影子單反事實、Reward 的 TP/SL/RR 與成本、Win 的校準及 EV、Time 的預測誤差、Brain 的 WAIT/RETURN 合理性。需保留缺證據狀態，禁止依事後 PnL 猜責任。不要為了填滿 6/6 而強行判 SOUND。
3. 對新增規則增加測試，重新跑**已保存的 24 月歷史**並讀取實際 CI log；每次報告變更前後的 SOUND/FAULT/UNKNOWN、missingAfter、完整審查數，並區分「規則一致性」與「市場預測品質」。
4. 在可靠度足夠前，不啟用第二層 Brain 權重學習。新參數假設需有未測過的診斷證據；訓練/OOS/獨立驗證分開；沒有 OOS 提升不晉升。
5. 檢查規劃書與實作是否偏離。階段性實際進展請**更新本檔及根目錄交接入口**；資料庫 schema 變更時更新字典增量，不要修改 10/17 原始快照冒充當時資料。

## 4. Supabase 資料庫字典：10/19 即時核對增量
專案 ID `xqtsmrzxixkecvaovzfy`，schema `public`、`ai_v2`。2026-10-19 即時查詢 `information_schema.columns`：**public 15 表、ai_v2 20 表，共 35 表**。10/17 的字典是 public 5 + ai_v2 20 = 25 表的歷史快照，後續新增 public 10 表（P1 四表、P4 六表）。

當前 public P4 六表與欄位（直接查 `information_schema`）：
- `p4_diagnostic_research_summaries`: `job_id text, summary jsonb, summary_sha256 text, created_at timestamptz`
- `p4_diagnostic_research_tasks`: `task_id text, source_job_id text, status text, attempt integer, record jsonb, record_sha256 text, created_at timestamptz, updated_at timestamptz`
- `p4_research_artifact_chunks`: `job_id text, iteration integer, spec_fingerprint text, artifact_kind text, chunk_index integer, payload jsonb, payload_sha256 text, committed_at timestamptz`
- `p4_research_checkpoints`: `job_id text, checkpoint jsonb, updated_at timestamptz`
- `p4_research_leases`: `job_id text, owner_token text, acquired_at timestamptz, expires_at timestamptz`
- `p4_research_rounds`: `job_id text, iteration integer, spec_fingerprint text, round_result jsonb, committed_at timestamptz`

10/19 public 完整表清單：`data_quality_issues`, `ingestion_jobs`, `market_data_watchlist`, `market_features`, `raw_candles`, `p1_training_configuration`, `p1_training_requests`, `p1_training_runs`, `p1_training_settings`, `p4_diagnostic_research_summaries`, `p4_diagnostic_research_tasks`, `p4_research_artifact_chunks`, `p4_research_checkpoints`, `p4_research_leases`, `p4_research_rounds`。

P4 artifacts 查詢範例：
```sql
select artifact_kind, count(*) as chunks
from public.p4_research_artifact_chunks
where job_id='p4_btc_24m_accept_20261018' and iteration=1
group by artifact_kind;
```
**注意**：payload 中有 `__p4_fragment_v1`；SQL `jsonb_array_elements` 直接計數不等於完整診斷紀錄。應用既有 artifact reader 重建，並核對 chunk hashes、recordCount。

## 5. 環境與交接安全
- GitHub：`jacklin79315/guber-ai-market-data-system`、branch `main`。
- Supabase：`xqtsmrzxixkecvaovzfy`。
- Railway：`1b703a9c-07fb-48ca-a5e5-def4c9531e34`；舊文件列有 `native-candle-collector` 及 `uber-v2-control-center`，**本輪未重新核對部署**，新對話應現場查詢，不可宣稱當前線上健康。
- GitHub Actions：[歷史診斷重新評估](https://github.com/jacklin79315/guber-ai-market-data-system/actions/workflows/p4-existing-diagnostic-reassessment.yml)；[最近成功執行](https://github.com/jacklin79315/guber-ai-market-data-system/actions/runs/39179181332)。
- 不把密碼、Supabase service role key、私人登入資料寫入 GitHub、交接文件或聊天。
- **操作習慣**：使用者說「繼續」即授權按規劃執行可安全執行的開發、提交、測試、讀取結果；應將測試＋結果查核視為同一工作，避免要求使用者反覆輸入「繼續」。重大不可逆變更、正式模型晉升、權限或實盤風險須先取得明確授權。報告真實 commit、CI run、結果，不虛構。

## 6. 新對話首個工作指令
請讀 `PROJECT_HANDOFF.md`、本檔、正式規劃書全文、P0～P7 大綱、10/17 資料庫字典；透過 GitHub、Supabase、Railway 重新核對即時狀態，先列出現階段、已實作、已驗證、未完成及偏離規劃的項目。然後直接從 §3 的第一個尚未完成項目開始工程實作；不重啟已失敗的舊參數臂、不憑記憶恢復四策略、不把 2,458 Risk SOUND 當成已學會獲利，並持續更新本檔。

## 7. 2026-10-19 P4 診斷歸因去重修正（待 CI 驗證）
- 針對同一角色由多項不變條件產生重複歸因、或窄範圍 SOUND 掩蓋 FAULT 的問題，新增 `mergeP4ActorAssessments`：同一角色只保留一筆，FAULT 優先於 SOUND／UNKNOWN，合併證據鍵及檢查理由。此修正只處理**診斷證據整合**，不代表市場預測能力改善。
- 即時 `p4-diagnostic-evidence.mjs` 與歷史唯讀 `p4-persisted-diagnostic-reassessment.mjs` 共用同一合併方式；歷史新歸因數僅計算先前缺少的角色。
- 新增 `frontend/p4-actor-assessment-merge.test.mjs` 測試：同角色多項 FAULT 不應造成診斷重複角色錯誤；Risk SOUND／FAULT 不論順序皆須保留 FAULT 及所有證據。
- GitHub 依序提交：`3de90bbc`、`83ce044e`、`223ff5f2`、`8e7dbf32`。**提交成功不等於 CI 通過**；下一步必須查自動歷史重評及測試是否通過，確認保存資料的 before/after 與缺失歸因統計，才可標記驗收。
- 安全邊界不變：無真實交易、無模型權重回寫、無 Champion 晉升；P4 尚未驗收完成。

### P4 診斷合併修正驗證補記（2026-10-19）
- Railway `uber-v2-control-center` commit `d15c1fe75db7ab0a3fabbf6b89b2c99649af5ac9`，deployment `cffbcd1c-19ad-4692-a981-73712c6ba85f` 狀態 **SUCCESS**；建置測試輸出 **594 pass**。前一版 `dd75f278` 因新增測試檢出合併理由被拆成字元而失敗（593 pass、1 fail），已在 `d15c1fe7` 修復。
- 此驗證證明程式測試／Railway 建置成功，**不是** GitHub 歷史重評 workflow 成功或歷史歸因統計已改變。GitHub Actions 新 run ID 與 24 月前後統計仍待查證。
- 另查 Supabase `p4_diagnostic_research_summaries`，最新可見 `p4_auto_20261019_d_job_1` 於 2026-10-18 22:11 UTC 已存檔，status `OOS_RESEARCH_EVALUATED`，followUpPlan 標示 `SELECTED_CHALLENGER_DID_NOT_IMPROVE_OOS`，**不可誤當 OOS 提升或正式晉升**。此為既存研究摘要，不是本次修正新跑的 24 月歷史重評。

### P4 24 月歷史重評可觀測性更新
- 回歸測試 commit `6f4737ab` Railway 部署 `ef5b12f3-91ed-494f-b2ed-7546f926c00d` **SUCCESS**，建置測試 **595 pass / 0 fail**；涵蓋舊 SOUND 與新 FAULT 衝突時不覆寫原始診斷。
- GitHub workflow `.github/workflows/p4-existing-diagnostic-reassessment.yml` commit `e7d8c911`：重新評估輸出存成 `p4-reassessment-report.json`，成功後在 GitHub Actions Step Summary 顯示 Champion/Challenger before/after 與各角色 SOUND/FAULT/UNKNOWN、missingAfter；同時上傳 14 天保留的報告 artifact。保留 SHA256 驗證、唯讀、無模型更新與無真實下單。
- **待驗證**：新 workflow 的實際 run ID、執行結論、24 月完整歷史 before/after 數據；不能僅因 workflow 提交成功就標記完成，也不可拿既存 OOS 研究摘要代替本次重評。

### P4 歷史專家名稱正規化缺口（待驗證）
- 發現 `assessP4ExpertHistory` 先用 `String(...).replace(/[-_ ]/g,'').toLowerCase()` 正規化名稱，卻只在 `actorFor` 中定義駝峰 `winProbability` 與 `riskPosition`，造成 `win_probability`／`risk_position` 等格式無法識別；缺失的診斷證據不能推斷為 SOUND。
- commit `8510c7bc` 補上正規化 `winprobability`、`riskposition` 對應，commit `1d1b83e9` 加入多種名稱回歸測試。**待 Railway 建置與既存歷史重評驗證**。
- workflow `e7d8c911` 已設定歷史重評報告與 artifact，但此處尚未取得可核對的 GitHub Actions run ID 或 24 月重評統計，不能標記歷史重評 PASS。

### P4 本輪部署及多重 Win FAULT 回歸測試
- Railway deployment `71f9f359-4835-4d15-b6b7-9fff305d8adc`，commit `f280f7f4`：**SUCCESS**、healthcheck PASS、Node tests **596 pass / 0 fail**。
- 檢查發現先前的「同 actor 多 FAULT」測試只產生一筆 Win FAULT，無法真正驗證重複歸因合併。commit `ae516fc4` 改用同時違反「負預期值」與「機率加權 EV 不一致」的證據，明確斷言合併前兩筆 Win FAULT，合併後一筆。**待新提交 CI／Railway 驗證**。
- 24 月 immutable 歷史診斷 workflow 的實際 run ID、前後六專家覆蓋數據仍未取得；維持 P4 未驗收，研究模式不下單、不自動晉升。

### P4 最新建置與既存歷史資料庫核對（2026-10-19）
- Railway commit `bb86daf5` deployment `69e20020-fbb0-49fd-bc74-b743c9fd8191` **SUCCESS**；Node 測試 **596 pass / 0 fail**。
- Supabase 唯讀查詢 `p4_research_artifact_chunks`，job `p4_btc_24m_accept_20261018` iteration 1：Champion `CHAMPION_DIAGNOSTICS` **254 chunks**（1227 standalone items + 243 fragments / 19 fragment starts，推算 1246 records）；Challenger `CHALLENGER_DIAGNOSTICS` **201 chunks**（1231 standalone items + 190 fragments / 15 fragment starts，推算 1246 records）。chunk_index 皆從 0 連續至最後索引；完整 SHA256／fragment 重組驗證仍需既有 reader workflow。
- GitHub 連接器僅提供 commit 對應 PR workflow runs，無法列出 push/workflow_dispatch 歷史 run；目前未取得 GitHub Actions 24 月重評 run ID／完整結果。不可將既存 artifact 數量誤報為新版 reassessment 成果；P4 未驗收。

### P4 24 月保存資料：唯讀證據可用性盤點（非正式重評）
- 直接查詢 Supabase `p4_research_artifact_chunks`，排除 `__p4_fragment_v1` 分段資料；Champion 1227、Challenger 1231 筆可直接解析紀錄。兩組全部有 `evidence.expertHistory` 非空陣列，也全部原始 `diagnosis.requiresReview=true`。
- `proposalAtDecision.expectedValue` 欄位有值：Champion 1167、Challenger 1170。注意「有值」不等於已校準／有預測效力。
- `accountAtDecision.equity`、`committedCapital`、`allocation` 三欄皆有值：Champion 118、Challenger 119；僅代表 Risk 資金占用檢查的基本欄位齊備，尚須依動作／數值合法性判定能否歸因。其他紀錄可能為 WAIT／RETURN，不能把未滿足 APPROVE 檢查條件直接當作 Risk 缺陷。
- 此 SQL 盤點**不包含**分段後重組的各 19／15 筆紀錄，**沒有**執行完整 SHA256 讀取與 JS `reassessP4PersistedDiagnostics`，也不是 GitHub Actions 重評結果。需完整報告才能評估六專家覆蓋率前後變化。

### P4 研究資料按決策類型核對（非正式重評）
- Supabase 唯讀核對既存 24 月診斷 artifact 的未分段紀錄：Champion 1227 = APPROVE 118 + WAIT 1109；Challenger 1231 = APPROVE 119 + WAIT 1112。
- APPROVE 中三個 Risk 80% 資金占用規則必要欄位均為合法數值：Champion 118/118、Challenger 119/119；以 `(committedCapital+allocation)/equity > 0.800000001` 判斷，**兩組皆 0 筆違反**。這只代表已檢查 APPROVE 子集符合此單一 hard cap，不是所有 Risk 維度都 SOUND。
- `expertHistory` 陣列長度：WAIT 均為 4 個步驟（Champion 1109／Challenger 1112），APPROVE 均為 6 個步驟（Champion 118／Challenger 119）。故不應以「WAIT 缺少 APPROVE 專用 Risk 欄位」推斷歷史資料缺失或診斷錯誤。
- 尚有 Champion 19、Challenger 15 筆分段紀錄待 SHA256 驗證與重組，亦未執行完整 JS 重新歸因；不宣稱全部 1246 筆皆符合上述比例。

### P4 歷史 WAIT 風控因果證據（唯讀 SQL 子集）
- 在未分段資料 Champion 1109、Challenger 1112 筆 WAIT 中，`expertHistory` 的 `riskPosition` 均為 `WAIT / NON_POSITIVE_EXPECTANCY`；`proposalAtDecision.expectedValue` 均為可解析數值且 **<=0**，正 EV 與缺失皆 0。
- 這支持現行 `assessP4ExpertHistory` 對該**單一規則**輸出 Risk SOUND 的證據條件；並非 WAIT 整體品質證明，也不是其他專家的 SOUND。正式 before/after 診斷仍需 JS SHA256 驗證重評。
- 原始 unassessedActors：Entry、Reward、Win、Time、Brain 於所有未分段紀錄均缺少歸因；Risk 缺少歸因只出現在 WAIT（Champion 1109／Challenger 1112）。這是舊診斷狀態，不代表新版重評已填補。

### P4 APPROVE Reward/Win 決策不變量核對（唯讀 SQL 子集）
- 在未分段 Champion 118、Challenger 119 筆 APPROVE：`expectedGain`、`expectedLoss`、`riskReward` 皆為數值；依 JS 同級容差 `1e-6 * max(1,abs(rr))` 檢查，RR 矛盾 **0/0**。
- `winProbability` 數值越界 **0/0**；明確數值型負 `expectedValue` 仍 APPROVE **0/0**。注意空值不代表合法數值；數值型 Win probability 與 EV 同時存在的 APPROVE 各僅 **58 筆**（Champion 58/118、Challenger 58/119），剩餘 Champion 60、Challenger 61 筆為 null。
- 這些是有限的資料一致性／guardrail 檢查，不等於 Win 勝率已校準，也不等於策略盈利。正式 SHA256 重組後的 JS 歷史 reassessment 仍未完成。

### P4 完整歷史重評執行器部署驗證（2026-10-19）
- Commit `070d4e524017780ab6f3239524d5bd5a45a6a674` 的 Railway deployment `c2d32394-fcad-4d83-a85f-00cb81e8dc1c` 為 **SUCCESS**；build Node tests **596 pass / 0 fail**。
- Runner 新增 fail-closed 驗收：Champion、Challenger 每側必須 1246 筆；before/after reviewed+unresolved 都等於 sourceRecords；modelUpdateApplied=false；原有 artifact reader SHA256 與 fragment 完整性驗證維持。
- Workflow `.github/workflows/p4-existing-diagnostic-reassessment.yml` 的 push.paths 包含 runner，故 commit 符合觸發條件；但 GitHub 連接器無法列出 push-triggered workflow runs，公開 Actions 頁面也未成功取得。**沒有可核實的 workflow run ID、report JSON 或 before/after 實際統計，正式 P4 歷史重評尚未驗收**。

### P4 分段 artifact 唯讀重組完成（2026-10-19）
- 使用 Supabase SQL `jsonb_array_elements WITH ORDINALITY` + fragment `part=0` 分組 + `string_agg(data ORDER BY chunk_index,ord)::jsonb` 重組：Champion **19/19**、Challenger **15/15** 分段紀錄全部完整且 `P4_DIAGNOSIS_V1`、`P4_FEEDBACK_V1` 格式有效；皆為 APPROVE。與 standalone Champion 1227、Challenger 1231 合計**各 1246 筆**。
- **重要校正**：分段 APPROVE 紀錄中 `accountAtDecision.equity/committedCapital/allocation` 三個數值欄位完整者 **0/19、0/15**，因此先前「全部 APPROVE Risk 資金占用欄位完整」只適用 standalone 子集（Champion 118、Challenger 119），**不得擴大宣稱為全部 APPROVE**。
- 分段 APPROVE 同時有數值型 `winProbability`、`expectedValue`：Champion **10/19**、Challenger **10/15**；合併 standalone 後各有 68 筆。全體 APPROVE Champion 137、Challenger 134；其他欄位品質及完整 JS 診斷待正式驗證。
- SQL 重組僅驗證 JSON 解析與 part 數量，**不等同 SHA256 chunk integrity 或 JS reassessment PASS**。無模型更新、無下單、無資料修改。

### P4 全部歷史紀錄 outcome 分類核對（2026-10-19）
- Champion 1246：CLOSED 118、SHADOW 19、WAIT 1109、RETURN 0。
- Challenger 1246：CLOSED 119、SHADOW 15、WAIT 1112、RETURN 0。
- 已重組的所有分段 APPROVE 紀錄皆為 SHADOW（Champion 19、Challenger 15）；先前完整 account/allocation 數值的 standalone APPROVE 則屬 CLOSED。**SHADOW 不能當作已結算績效，CLOSED 與 WAIT/SHADOW 應分開分析。**
- 以上為 SQL 唯讀 JSON 重組及分類統計，並非 SHA256 驗證的 JS 診斷重評，尚無可核實的正式 before/after coverage report。

### P4 SHADOW 六專家流程證據核對（2026-10-19）
- SQL 唯讀重組 SHADOW：Champion 19、Challenger 15；全部 `expertHistory` 為陣列且包含 Entry/Reward/Win/Risk/Time 各 CONTINUE、Brain APPROVE 六步。
- SHADOW 同時有非 null `proposalAtDecision.winProbability` 與 `expectedValue`：Champion 10/19、Challenger 10/15；其餘缺少兩項數值，不可推論已校準。
- 專家流程完整 ≠ 六位專家 SOUND；SHADOW 不應混入 CLOSED 績效，亦不能憑流程繼續就回饋正分。仍待正式 SHA256 + JS reassessment。

### P4 GitHub Actions 正式 24 個月重評報告已取得（2026-10-19，關鍵驗收）
- GitHub Actions run [39233114328](https://github.com/jacklin79315/guber-ai-market-data-system/actions/runs/39233114328)，job 117995623973，commit `070d4e524017780ab6f3239524d5bd5a45a6a674`：所有步驟 SUCCESS。
- 已實際下載並解析 artifact `p4-24m-readonly-reassessment` ID **12177528150**（ZIP SHA256 `c22691055ff83a4c977c1f284d83baa62630a19ed9bde9798b4e9f941a2829e0`），報告 `status=PASS`，`modelUpdateApplied=false`、`ordersEnabled=false`。
- Champion 254 chunks / 1246 records；CLOSED 118、SHADOW 19、WAIT 1109。before reviewed 0/unresolved 1246；after reviewed **0**/unresolved **1246**。addedByActor Risk 1109，其餘五專家 0。Risk SOUND 1227、FAULT 0、missing 19；Entry/Reward/Win/Time/Brain 各 missing 1246。
- Challenger 201 chunks / 1246 records；CLOSED 119、SHADOW 15、WAIT 1112。before reviewed 0/unresolved 1246；after reviewed **0**/unresolved **1246**。addedByActor Risk 1112，其餘五專家 0。Risk SOUND 1231、FAULT 0、missing 15；Entry/Reward/Win/Time/Brain 各 missing 1246。
- **結論：執行及 artifact integrity PASS，但完整診斷覆蓋率仍 0%，不可宣稱 P4 診斷完成或模型改善。** Risk SOUND 只表示狹義規則符合，不代表完整風險品質；禁止依此調整權重或升級 Champion。
- 後續：優先釐清為何既有 `assessP4ExpertHistory`、`assessP4ProposalInvariants` 未產生其餘五專家 SOUND（目前規則多數僅在可證明違規時輸出 FAULT，並不自動替正常流程給 SOUND）；設計有明確證據門檻的正向歸因與 UNKNOWN，不得憑 PnL 或無證據硬填完整度。

### P4 分類重評報告程式驗證（2026-10-19）
- Commit `2c65562ff548083da546604134da9459dd7408b5` 新增唯讀 `byOutcome`：CLOSED/SHADOW/WAIT/RETURN 各自記錄 records、beforeReviewed、afterReviewed、missingByActor。
- Commit `94161205c72bb2a5d1a39531e73bdf0267fc07a1` 將 `byOutcome` 加入 GitHub Actions Step Summary（原始 JSON artifact 隨 runner 自動包含此欄位）。
- Railway control center 部署 `085ad7b5-9467-46ba-9eb6-18ace128ae59` SUCCESS，Node tests 596 pass / 0 fail。
- 尚未取得 **commit 94161205** 對應的 GitHub Actions 新重評 run/artifact；不可將 Railway 成功誤認為歷史重評完成。原先 run 39233114328 的正式結果仍有效，但其 commit 是 `070d4e52`、沒有 `byOutcome`。

### P4 分類報告傳遞缺口與修復（2026-10-19）
- Actions run [39265430947](https://github.com/jacklin79315/guber-ai-market-data-system/actions/runs/39265430947) job 118103650013，head `94161205` SUCCESS；artifact 12193076679，SHA256 `20e0a0ee7f0542e831c88f8e936cf5e21d86421f03238d80bf54504003dd8451`，已實際下載解析。
- 報告 1246/side，PASS，原本診斷完整度仍 0；但 **沒有 `byOutcome`**。根因：`frontend/p4-autonomous-diagnostic-research.mjs` 的 `inspectPersistedP4ResearchRound` 在重新組裝 `reassessment` 摘要時漏傳 `byOutcome`，不是原始資料遺失。
- 修復 commit `e8b18e7cb7e32a8ad9317840dbec8bba4ef12514` 已補上摘要欄位傳遞。**尚待此 commit 的 CI 24 個月重評 artifact 驗證**；舊 run 不可視為分類報告驗收。

### P4 分類隔離測試通過（2026-10-19）
- Commit `0a8928d55132a58c0745f8495abc39804102047f` 在 `frontend/p4-persisted-diagnostic-reassessment.test.mjs` 增加 CLOSED/SHADOW/WAIT 分類隔離測試，檢查 Risk 缺證據只落在 SHADOW、分類總數與整體一致，以及不更新模型/不啟用交易。
- Railway deployment `09c8f6f3-c261-4092-99c0-5f8040dbeff0` **SUCCESS**；Node tests **597 pass / 0 fail**。
- 仍須核對含 `byOutcome` 的新版 GitHub Actions artifact；不得將 Railway test pass 視為 24 個月歷史重評驗收。

### P4 24m byOutcome 正式驗收（2026-10-19）
- GitHub Actions run `39266985531`, job `118109072090`, commit `530af7a31b9dfe82d04c942706a8b367a4d834dd` **SUCCESS**；artifact ID `12193173718` SHA256 `a9b3627d064fa294ed7d5e599acdacc89560586c885ddf5303e62b6d4c24b4bd`，已下載解析，`status=PASS`、`modelUpdateApplied=false`、`ordersEnabled=false`。
- Champion 1246: CLOSED 118, SHADOW 19, WAIT 1109；Challenger 1246: CLOSED 119, SHADOW 15, WAIT 1112。RETURN 均 0；分類加總一致。
- `byOutcome` 已確實出現在正式 artifact：兩組 CLOSED/WAIT Risk missing=0；SHADOW Risk missing 分別 19/15；Entry、Reward、Win、Time、Brain 在各類全部缺失。兩組 beforeReviewed=afterReviewed=0，仍是 **診斷完整度 0**，不可混淆成分類報告驗收失敗。
- 後續優先依可驗證的逐專家證據補齊歸因，保持 UNKNOWN 不臆測，嚴禁根據 SHADOW 誤算已結算績效；未授權自動下單/自動權重更新。

### P4 Reward 數學不變條件增量（2026-10-19）
- `6057c1f28fa3f9e0c30623665c6b396b8b87b933`：核准提案若 `expectedLoss<=0` 或 `riskReward<0` 且欄位為有限數值，新增 Reward FAULT；缺值維持 UNKNOWN，不依 PnL 判定。
- `11417121caf3dd3253f3880b1e03e2894bd457ed`：新增兩項 Reward 單元測試，Railway deployment `24c21d77-e802-433d-9a46-c22bcad3a949` **SUCCESS**，**599 tests pass / 0 fail**。
- `.github/workflows/p4-existing-diagnostic-reassessment.yml` 對規則檔 push 有自動觸發；尚未取得上述新規則對應 Actions run 的歷史重評報告，故 **不可宣稱 24m 資料已有 Reward FAULT**。

### P4 Reward 歷史重評實證（2026-10-19）
- Actions run `39268274819`, job `118113496292`, commit `6057c1f28fa3f9e0c30623665c6b396b8b87b933` **SUCCESS**；artifact `12194500283` SHA256 `1bd95a79a6919a24b937e1074f2c659ce3331c2dc69f1cadadd2626db0943721` 已下載解壓核對，status PASS。
- Champion/Challenger 各 1246 筆，新增 Reward 歸因各 **0**，Reward FAULT 各 **0**；Risk SOUND 1227/1231；完整診斷 0/1246（兩組皆然）。分類 CLOSED 118/119、SHADOW 19/15、WAIT 1109/1112。
- 解讀：新加的 Reward 數學不變條件在這批資料沒有觸發，不等於 Reward 預測已被驗證；維持 UNKNOWN，不得用零錯誤宣稱 SOUND、不得更新模型或下單。下一步應評估原始 evidence 欄位覆蓋及可驗證的因果判準。

### P4 各專家因果輸入欄位覆蓋率（2026-10-19）
- `1b87b898093c9b5d651ef942cb8d1595e8370f7d`：`inspectP4DecisionInputCoverage` 新增 CLOSED/SHADOW/WAIT/RETURN 分類、APPROVE、expertHistory/proposal 存在量，及 Entry.entryRange、Reward.expectedGain/expectedLoss/riskReward、Win.winProbability/expectedValue、Time.expectedHoldingMs 的**有效數值欄位覆蓋**。
- `5533f2dcd386063f198454031fcdf12f03f572de`：歷史重評 runner 在正式 artifact 輸出 `decisionInputCoverage`，方便核對 24 個月兩組樣本實際可用證據。
- 上述僅統計欄位可用性，不等於專家 SOUND/FAULT 或概率校準；**尚待 CI 與 Actions artifact 驗證**，嚴禁自動下單與模型更新。

### P4 證據覆蓋研究修復與 CI 驗收（2026-10-19）
- `1b87b898`–`892b2f8b` 的初版 Railway 測試為 597 pass / 2 fail，原因是 legacy research fixture 未提供 outcome；**不可當作通過**。
- `a6761bf55f1fe91bb0c3c63fe2dfc0f0d519ce1b` 修復缺 outcome 的研究樣本相容性（不虛構分類），Railway deployment `438deb41-59a7-4ffd-ae9f-3b0a16e43c03` **SUCCESS，599 pass / 0 fail**。
- `5e4bebb7beaefc1ac03ae3f328050650e910c0da` 加強 Actions Step Summary：必須存在 `decisionInputCoverage`、與 1246 records/side 對齊，分類合計一致，並輸出欄位覆蓋詳情；**尚待新 Actions artifact 實際驗證**。

### P4 24 個月證據覆蓋報告驗收門檻（2026-10-19）
- `a9463f36691068e4f694a1068d1ee59507083635` Railway deployment `11148f54-e14a-4ee8-a640-ba29d363cf24` SUCCESS，600 tests pass / 0 fail。
- `83477921ac686ca4fd9e9052d554c7ab5f2d026d`：歷史重評 runner 除總量與 CLOSED/SHADOW/WAIT/RETURN 一致性外，要求 Entry.entryRange、Reward.expectedGain/expectedLoss/riskReward、Win.winProbability/expectedValue、Time.expectedHoldingMs 每個 outcome 的統計欄位存在且為整數；防止缺欄位報告誤判 PASS。
- 待辦：確認新版 GitHub Actions artifact 的真實 24m `decisionInputCoverage`，根據有效資料數量決定診斷研究優先順序；不得以欄位存在當作 SOUND，亦不得自動更新模型或下單。

### 2026-10-19 P4 歷史重評 HTTP 500 排查進度
- GitHub Actions 於 2026-10-19T14:45Z 回報 `manifest read failed 500`；此為 Supabase REST 讀取階段錯誤，不能推論資料遺失或診斷不合格。
- SQL 已確認 immutable chunk：CHAMPION_DIAGNOSTICS 254、CHALLENGER_DIAGNOSTICS 201；未刪除或重新訓練。
- `aa232aa5`：縮小原本 payload manifest 分頁並加入暫時性錯誤重試；`23a077bf`：改成 metadata-only (`chunk_index,payload_sha256`) 索引，完整 payload 由原有 store reader 分批讀取並驗證 SHA256、重組碎片；`33d6f3aa`：輕量索引分頁調為 100；`a9a69fce`：修正 Actions 摘要 shell 引號；`0d56d567`：HTTP 錯誤含 requestId、offset；`b37096d8`：拒絕超出分頁上限；`526ce2e8`：區分 JSON 解碼與 HTTP 錯誤。
- `b37096d8` Railway build 已 600 tests pass / 0 fail，當時 deployment 尚 DEPLOYING；`526ce2e8` 待 CI 驗證。
- **阻塞：尚無新 GitHub Actions 歷史重評 PASS artifact**。切勿宣稱 1246+1246 筆已完成新一輪重評；仍需確認真實 decisionInputCoverage、六專家責任歸因與 OOS 有效性。系統研究專用，不下真單、不自動改模型。

### 2026-10-19 P4 歷史重評正式解除阻塞（Actions 39275063376）
- GitHub Actions run `39275063376` job `118137096046`，commit `3ebbe5c13df06a2302171f50cc0bf70447f19e59`：**SUCCESS**；artifact `p4-24m-readonly-reassessment` ID `12196532863`，已下載解析 `p4-reassessment-report.json`，`status=PASS`，`ordersEnabled=false`，`modelUpdateApplied=false`。
- 完整讀取及重組 immutable chunk：Champion 254、Challenger 201，兩組各 1246 決策。Champion CLOSED 118 / SHADOW 19 / WAIT 1109；Challenger CLOSED 119 / SHADOW 15 / WAIT 1112。RETURN 均 0。
- 完整六專家診斷兩組皆 **0/1246**；Risk SOUND Champion 1227、Challenger 1231；其餘 Entry/Reward/Win/Time/Brain 仍缺因果歸因證據，不得宣稱模型已學習或改善收益。
- 已核對有效輸入：Champion APPROVE 且勝率未知 69，Challenger 66；CLOSED 勝率數值覆蓋兩組皆 58，SHADOW 兩組皆 10。SHADOW 不算已結算交易。
- `3ebbe5c1` Railway deployment `c13f2252-0d4a-41e5-ac42-36c9f3fb3c5b` SUCCESS，600 tests pass / 0 fail。先前 HTTP 500 阻塞已於此輪正式歷史重評解除。下一階段聚焦可驗證的因果證據及獨立 OOS 驗證；禁止自動下單與自動更新正式權重。

### 2026-10-19 P4 診斷不變條件測試驗收
- `506c213464f2e9a8e058625724db4bbb7a74b573`：Reward RR 算術矛盾、Win EV 算術矛盾、數學一致不得臆造 SOUND，共新增 3 個測試。Railway deployment `271cd24b-1c20-455c-8b7b-a1d382292a5c` **SUCCESS，603 tests pass / 0 fail**。
- 現有 `planP4EvidenceResearchTasks` 已將未知勝率、未知 EV、各專家因果證據缺口列入研究任務，尚不等於訓練模型或完成因果驗證。下階段優先驗證已結算 CLOSED 的勝率校準資格及 OOS 分割；SHADOW/WAIT 不可當實際交易報酬。

### 2026-10-19 P4 校準資格驗證進度
- `90e73986`：新增 58 筆 CLOSED 勝率證據不滿足 30/30 獨立校準最低門檻的回歸測試；Railway 604/604 PASS。
- `772b5dbb`：分離缺少勝率與無效勝率；首次提交含換行語法錯誤，已由 `7d2d44fb` 修正，Railway 605/605 PASS，部署 SUCCESS。
- `507c6a46`：24 個月重評 JSON 增加 `calibrationEligibility`，Railway 605/605 PASS 且部署 SUCCESS。
- `9e75d1d6`：GitHub Actions 摘要顯示並驗證校準資格，增加依賴檔案的 push 觸發路徑；提交後查詢 commit workflow runs 暫無結果，**不得標記歷史重評 PASS 或宣稱已取得合格樣本數**。Railway 當時 DEPLOYING。
- 已知每側 CLOSED 有數值勝率 58 筆，並不等於 58 筆完整可校準觀測；必須從新的歷史重評 artifact 取得 `eligible`、`excluded` 與時間窗驗證結果。研究模式，不更新權重、不自動下單。

### 2026-10-19 Supabase 歷史 CLOSED 校準證據實查（唯讀 SQL）
- 原始 24 個月診斷 artifact：Champion CLOSED=118，Challenger CLOSED=119；各有 58 筆數值 `proposalAtDecision.winProbability`。
- CLOSED 中 `evidence.realizedWin` 明確 boolean = **0/118、0/119**；`evidence.closedAt` 數值時間戳記 = **0/118、0/119**。現行 `extractP4ClosedWinObservations` 同時要求有效機率、`decisionTime`、`closedAt`、`realizedWin`，故**目前可用校準樣本必為 0**，不是 58。
- Champion CLOSED evidence 已確認有 `netPnl`、`exitReason`、`exitPrice`、`decisionTime`，但沒有 `realizedWin` 或 `closedAt`。**不得直接以 netPnl 正負推導並回填歷史 `realizedWin`，亦不得捏造 closedAt**；應先追查 replay CLOSED 事件原始結算時間與 outcome 定義、確定可驗證且無未來資訊洩漏後再新增證據輸出與新一輪 replay。
- GitHub Actions commit `9e75d1d6` 的 workflow run 查詢當時為空；Railway `9e75d1d6` 部署 SUCCESS。以上 SQL 為直接資料庫觀察，不代表 Actions artifact 已完成重新驗證。

### 2026-10-19 P4 CLOSED 因果結算證據驗證與舊資料防護
- `frontend/p3-causal-history.mjs` 的 `attachClosedTimes` 可用同交易對、同週期的 `exitIndex` 對應原始 K 線 `closeTime`，並拒絕索引越界與非遞增 K 線；`frontend/p4-diagnostic-evidence.mjs` 可將 `closedTime` 保存為 `closedAt`，將非零且有限的已結算 `pnl` 標為 `realizedWin`。缺資料仍為 null，不可臆測。
- Commit `32eb283edf0b1491d2e17a0b871875d393ed1565` 新增 CLOSED 結算時間與無效索引測試；Railway 607 tests pass / 0 fail，部署 SUCCESS。
- Commit `9c2167ea648d818e10c15100efd83f36a53e5a93` 在唯讀舊歷史重評 runner 加入校準資格 fail-closed 防護：已知 immutable round 的 eligible 必須為 0，且 mode=RESEARCH_ONLY、promotionAllowed=false；Railway 607 tests pass / 0 fail，部署 SUCCESS。
- **尚未定位完整 24 個月 replay 的呼叫端是否實際傳入 candles 與 exitIndex**，亦未啟動新的 24 個月 replay；舊 round 不得覆寫。此階段只驗證組件及安全門檻，**不可宣稱完整資料鏈已驗收或已具備自主學習能力**。
- 下一步：找出 replay runner 真實入口及 `collectP4DiagnosticEvidence` 呼叫點，新增整合測試確認 CLOSED 的 `closedAt` / `realizedWin` 隨新 artifact 保存，並以獨立時間窗驗證校準資格；研究專用，不自動下單、不更新正式模型權重。

### 2026-10-19 P4 真實回放呼叫鏈定位
- 已從 GitHub 原始碼確認：`p4-diagnostic-manual-runner.mjs` → `p4-diagnostic-persisted-run.mjs` → `p4-diagnostic-backend-research.mjs` → `p4-diagnostic-chronological-run.mjs` → `p4-diagnostic-oos-experiment.mjs` → `p4-diagnostic-arm-replay.mjs` → `p4-challenger-comparison.mjs` → `runSequentialFiveExpertReplay` / `collectP4DiagnosticEvidence`。
- `p4-diagnostic-backend-research.mjs` 使用 `loadP4SegmentedHistoricalCandles` 取得已驗證 K 線；`p4-challenger-comparison.mjs` 明確以 `collectP4DiagnosticEvidence({...championResult,candles})` 及 challenger 同型呼叫，證實此比較路徑有傳入 K 線。
- `collectP4DiagnosticEvidence` 透過 `attachClosedTimes` 依 `exitIndex` 對應 `closeTime`，形成 CLOSED `closedAt`，並依非零有限已結算 PnL 產生 `realizedWin`；已有單元測試，Railway 607/607 PASS。
- **限制**：這證實目前 P4 診斷比較器的程式接線，尚未驗證新的 24 個月完整執行與 artifact 持久化。歷史 immutable round 的兩個欄位仍缺失；不得覆寫舊資料或聲稱新 round 已完成。下一步新增比較器至持久化 artifact 的端到端整合驗證，並確認新的 job ID 與 OOS 時間隔離。

### 2026-10-19 P4 CLOSED 證據端到端模擬持久化驗收
- `ee46e0f3b08cee14fd6c935f85aa0fb996d5b10f`：新增 P4 Champion/Challenger 比較器整合測試，使用原始 K 線驗證 CLOSED `closedAt` 對應 K 線、`closedAt > decisionTime`、`realizedWin` boolean 與模型不更新。Railway **608/608 PASS**，部署 SUCCESS。
- `24f59cf5f2f6e45f42e5d0e84b369cc61e421f8e`：新增 P4 比較結果 → 模擬 artifact chunk write/read（hash 完整性）→ `extractP4ClosedWinObservations` 的端到端測試；兩組 CLOSED 結算欄位完整，且不允許模型更新或 Champion promotion。Railway deployment `be8e5fa6-d391-492c-b6f7-b893fbf5154e` **SUCCESS，609/609 PASS、0 fail**。
- **驗收界線**：此為 mock Supabase 介面的測試，不是新 24 個月正式 artifact 的寫入/讀回；未啟動新回合、未覆寫舊 immutable round、未調整正式權重或下單。
- 下一步：確認新研究 job 的持久化執行入口、唯一 job ID、OOS 窗口與完整 CLOSED 因果證據，再決定是否進行真實歷史回放驗收；不得把模擬測試的成功等同真實資料校準合格。

### 2026-10-19 P4 不可變研究資料寫入前因果防護
- `76543d1ea3ebe92ff22c71029ed831f1dca63079`：`p4-historical-research-job.mjs` 新增寫入 artifact 前的 CLOSED 時間完整性阻擋，任何 CLOSED 缺少 `closedAt > decisionTime` 即 fail-closed；Railway 609/609 PASS、部署 SUCCESS。
- `09412ee0ba19d3b00e24e24aab03b2d04604ab29`：抽出 `assertP4ClosedArchiveTimes` 供測試與原執行路徑共用，避免測試與正式防護分岔；Railway 部署 SUCCESS。
- `4827afed9951babebdbe3ce0f47f42f4846b68dc`：新增兩項回歸測試，分別確認 Champion/Challenger 的錯誤或缺失結算時間被阻擋，以及零損益/未知勝負不會被捏造為校準有效。Railway **611/611 PASS，0 fail**；截至紀錄時部署狀態 BUILDING，待確認 SUCCESS。
- 仍未啟動新的真實 24 個月研究回合；既有 immutable artifacts 不變，研究模式不下單、不更新模型、不升級 Champion。

### 2026-10-19 依使用者指示調整 P4 優先順序
- 使用者明確重申：私人及少數朋友使用的**投資研究顧問**，不執行真實下單；停止新增非必要商業級防護，優先完成 AI 診斷、Challenger 自主學習與獨立驗證。
- `c8928fdd` 將手動 24m workflow 的 `P4_PARTITIONED` 設為 TRUE；`f5b24a06` 在後端限制 24m 需時間分割，`9ce2e45a` 修正既有測試的預期。時間分割是目前工程選擇，非使用者確認的永久固定比例需求；最新 Railway 測試/部署仍須核對。
- 程式核對：`p4-research-cycle.mjs` 會依研究回饋選擇下一研究父版本；`p4-research-feedback.mjs` 目前僅用同窗口成本後淨損益且至少 30 筆 CLOSED 比較；`p4-partitioned-research-cycle.mjs` 只保留未使用的 OOS 區間，回傳 `RESERVED_NOT_EVALUATED`，**尚未執行獨立 OOS 驗證**。
- 下一個主要開發任務：在不洩漏未來資料、不自動升級正式 Champion 的前提下，完成 OOS 獨立回放、成本與風險績效比較，以及診斷驅動的 Challenger 參數更新；避免持續堆疊無關防護。

### 2026-10-19 P4 獨立 OOS 實際回放第一版
- `46d8e0cc8619cffdc26a0f0a9827b64b6dd843e4`：`runP4PartitionedResearchCycle` 在研究迭代完成後，凍結研究選出的參數，對保留的時間後段 K 線執行 Champion 與凍結候選的隔離回放；回傳 OOS 已結算交易數、淨損益及樣本是否足夠，不自動升級正式 Champion。Railway 611/611 PASS、部署 SUCCESS。
- `aadc93827269d9d60468943a8b5b1dbe37510e64`：新增研究提前停止時 OOS 不得宣稱已驗證的測試；Railway **612/612 PASS、部署 SUCCESS**。
- `ca58d116a153857bbbdec71d9be656e59f5666e7`：新增完整研究→凍結→OOS 回放測試，確認 128 根研究、32 根未使用驗證資料、樣本不足時不宣稱改善。Railway build **613/613 PASS、0 fail**，部署尚待 SUCCESS 確認。
- 此階段僅完成測試 fixture 的 OOS 流程；尚未完成新 24 個月真實歷史回放，也尚未證明診斷能有效更新 Challenger、獲利改善或正式 Champion 晉升。下一步應以診斷驅動參數學習、真實 OOS 績效（包含風險與成本）為主，不增加非必要防護。

### 2026-10-19 P4 診斷介入研究版本選擇
- `6cefa3d002da5e6c15a24d7967fb39cee9afe55f`：`assessP4ResearchFeedback` 開始讀取既有 `comparison.diagnosticAudit.challenger.actors.Risk`；若有已診斷負面 Risk 事件，則即使 Challenger 同窗口淨損益較高，也不選為下一輪研究父版本。此為研究選擇門檻，不是模型參數自主更新，也不改正式 Champion。
- `5b8e91200f006ae01aa0f8071abbb483f65ff383`：新增高損益但 Risk 負面診斷的回歸測試；提交後 Railway 尚待建置/部署驗證。
- 重要限制：目前只對已歸因 Risk negative 生效；其他專家尚缺可信的參數級因果歸因，不得宣稱六角色診斷全面驅動自主學習。下一步建立 Entry/Reward 的可歸因方向性更新與獨立 OOS 驗證。

### 2026-10-19 P4 六角色診斷參與研究版本選擇
- 前一輪 `5b8e9120` 已於 Railway **614/614 PASS**、部署 SUCCESS。
- `cc135fc99c7fc35ca8ca6a681b7fb8c1c3ec1b28`：同窗口研究父版本選擇不再只看 Risk；只要 Challenger 診斷 audit 中 Entry/Reward/Win/Risk/Time/Brain 任一角色有 `negative > 0`，即阻擋僅憑較高淨損益選作下一研究父版本。UNKNOWN/unresolved 不虛構 FAULT。
- `1196f5d11a11bb1ec517c10f912ddaf184fa6408`：新增 Reward 已歸因錯誤阻擋及 Entry unresolved 不誤判兩項測試；提交時 Railway 尚待最新建置/部署驗證。
- 仍只是研究父版本篩選，**不是**六專家可歸因參數更新、完整自主學習或正式模型升級；下一步應以實際診斷原因指向可訓練參數，並用 OOS 證明改善。

### 2026-10-19 P4 多角色診斷比較修復
- 前版 `511f454c` Railway 617 tests / 616 pass / 1 fail：同樣 Risk 缺失的 Champion/Challenger 應可比較改善，但現有六角色絕對負面阻擋導致錯誤拒絕。
- `6e1cc94ba2c7ef31bc67788c7ec4655c37a4d36b` 修正 `p4-research-feedback.mjs`：比較 Entry/Reward/Win/Risk/Time/Brain 各自的已診斷負面數與 Champion 基準，僅 Challenger 較差或缺可信基準時阻擋研究父版本前進。既有相同 Risk 負面測試、Reward 負面測試與 UNKNOWN 不虛構測試應一併驗收。
- 最新 commit Railway 尚 BUILDING，未宣稱 PASS。此仍是診斷參與**研究候選選擇**，不是診斷驅動參數調整或完整自主學習。

### 2026-10-19 P4 診斷引導參數探索第一版
- 上輪 `6e1cc94b` Railway 617/617 PASS，部署 SUCCESS。
- `73981af7`：`generateChallengerParameters` 新增 `preferredActor`，可將變異限制在 Entry 的 `entry*` 或 Reward 的 `reward*` 參數，仍由種子決定方向；不聲稱已有可證實的參數調整方向。
- `a365d1fe`：研究單輪傳入 `preferredActor`；`54ba6750`：研究循環從上一輪比較的診斷結果讀取 Entry/Reward 負面事件數，較多的一方引導下一輪參數家族；同數或沒有可用歸因時沿用原探索。
- `36a2de41`：新增 Entry/Reward 參數所有權測試。最新 Railway 尚在建置，未驗收；未進行新 24m 真實回放。
- 限制：目前僅診斷引導**參數家族**，不代表已學會最佳調整方向或有可靠獲利改善；未自動升級 Champion，也不執行真實下單。

### 2026-10-19 P4 診斷引導研究的跨輪測試
- `d32d7bb` Railway 618/618 PASS，部署 SUCCESS。
- `20b94daa`：研究每輪紀錄 `preferredActor`（Entry/Reward/null），並能從上輪已存的比較診斷紀錄取得探索焦點，方便追蹤哪種診斷引導了哪次參數變異。
- `b8cbc090`：新增兩輪整合測試，第一輪模擬已歸因 Entry 負面，驗證第二輪只變異 Entry 所屬參數、正式 Champion 不變。最新 Railway 尚 BUILDING，未宣稱測試通過。
- 下一步：確定跨輪整合測試通過，再做診斷引導與未引導探索的同資料比較、真實歷史 OOS 測試；目前不聲稱 AI 已達穩定盈利。

### 2026-10-19 P4 跨輪診斷傳遞修復
- `b8cbc090` 跨輪 Entry 測試揭露下一輪錯讀未更新的 ledger 診斷資料，Railway 619/618 PASS/1 FAIL。
- `cfe66dbc` 改由上一輪已保存的 `ledgerSnapshot` 優先取得診斷，Railway **619/619 PASS**，部署進行中。
- `60877a5e` 補上 Reward 診斷引導下一輪 Reward 參數探索的跨輪測試，Railway 尚待建置驗收。
- 目前實現「已歸因問題 → 下一輪參數家族選擇 → 研究回放」初步閉環；仍未證明參數方向最佳、OOS 改善或穩定獲利，也不自動下單／升級 Champion。

### 2026-10-19 P4 相對診斷探索修正
- 上一版 `0c98daf5` Railway **620/620 PASS**，部署 SUCCESS。
- 確認 `p4-challenger-comparison.mjs` 會實際計算六角色 `diagnosticAudit` 並傳給研究回饋，並非只有測試資料。
- `0f4a15f1`：跨輪 Entry/Reward 探索焦點改為比較 Challenger 相對 Champion 的已歸因負面事件增量，不再只看 Challenger 絕對數；`9ef894b6` 增加雙方相同 Entry 負面事件時不得偏向 Entry 的測試。
- Railway 最新版仍 BUILDING，尚待驗收；尚未進行真實 24 個月 OOS 績效比較或證明參數方向具有預測改善。

### 2026-10-20 P4 診斷引導與一般探索對照準備
- 前版 `c04b699f` Railway **621/621 PASS**，部署 SUCCESS。
- `d0fc53af`：研究循環新增 `explorationMode`，`DIAGNOSTIC_GUIDED`（預設）按 Entry/Reward 相對負面診斷選參數家族，`UNGUIDED` 忽略診斷，沿用確定性種子變異；每輪與回傳結果記錄模式，供同資料同種子對照。
- `894c5d8f`：新增未引導模式可重現性測試，確保診斷事件不影響控制組變異。Railway 尚在建置，未宣稱通過。
- 注意：尚未實際執行 guided/unguided 的 24 個月歷史 OOS 對照；模式切換與單元測試不代表績效改善。
