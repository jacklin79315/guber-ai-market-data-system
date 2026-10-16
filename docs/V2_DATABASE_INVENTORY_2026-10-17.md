# V2 資料庫結構清冊（交接備份）
日期：2026-10-17；Supabase project: xqtsmrzxixkecvaovzfy

> 本清冊依已成功執行的 V2 DDL、先前已查詢的 watchlist 欄位，以及目前確認的資料表清單編寫。原始資料其他四張 public 表的**完整逐欄 metadata 尚待重新查詢**；絕不虛構欄位。V2 精確欄位請以 [SQL 原始檔](../sql/v2_research_schema.sql) 為準。

## public：既有行情資料與收集控制（5 張，均保留）
1. `raw_candles`：原生 Binance K 線，原始資料不得為訓練改寫。
2. `market_features`：與原始資料分離的技術指標。
3. `market_data_watchlist`：collector 實際讀取的商品抓取名單。
4. `ingestion_jobs`：收集與回補工作紀錄。
5. `data_quality_issues`：資料品質與缺漏異常。

### market_data_watchlist：已逐欄查證
| 欄位 | 型別 | 預設值/備註 |
|---|---|---|
| id | bigint | GENERATED ALWAYS identity；不可手動填 ID |
| source | text | 'BINANCE' |
| market | text | 'SPOT' |
| symbol | text | 必填 |
| enabled | boolean | true |
| lookback_years | smallint | 3 |
| intervals | text[] | ['15m','1h','4h','1d'] |
| backfill_requested_at | timestamptz | now() |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

已加入並啟用：BTCUSDT (id 1)、ETHUSDT (id 2)、SOLUSDT (id 3)、BNBUSDT (id 4)、XRPUSDT (id 5)、DOGEUSDT (id 6)、PENGUUSDT (id 7)。以上新增五筆是資料庫已回傳成功的操作結果。

## ai_v2：新研究資料（6 張，已建立）
### research_runs
`id uuid PK`, `status text`, `symbol text`, `timeframe text`, `horizon text`, `training_start timestamptz`, `training_end timestamptz`, `seed bigint`, `data_fingerprint text`, `code_revision text`, `config jsonb`, `metrics jsonb`, `error_message text`, `created_at timestamptz`, `started_at timestamptz`, `finished_at timestamptz`.

### expert_versions
`id uuid PK`, `role text`, `version text`, `artifact_uri text`, `artifact_hash text`, `training_run_id uuid FK -> research_runs`, `metadata jsonb`, `created_at timestamptz`. Unique(role,version).

### champions
`role text PK`, `expert_version_id uuid FK -> expert_versions`, `promoted_at timestamptz`, `promotion_reason text`.

### decisions
`id uuid PK`, `run_id uuid FK -> research_runs`, `symbol text`, `timeframe text`, `horizon text`, `decision_open_time bigint`, `action text`, `direction text`, `entry_low numeric`, `entry_high numeric`, `stop_low numeric`, `stop_high numeric`, `take_profit_low numeric`, `take_profit_high numeric`, `proposed_fraction numeric`, `expert_outputs jsonb`, `brain_reason jsonb`, `created_at timestamptz`. Unique(run_id,symbol,timeframe,horizon,decision_open_time).

### simulated_trades
`id uuid PK`, `decision_id uuid UNIQUE FK -> decisions`, `entry_open_time bigint`, `exit_open_time bigint`, `fill_price numeric`, `exit_price numeric`, `position_size numeric`, `fee_paid numeric`, `slippage_paid numeric`, `net_pnl numeric`, `exit_reason text`, `result jsonb`, `created_at timestamptz`.

### diagnostics
`id uuid PK`, `run_id uuid FK -> research_runs`, `decision_id uuid FK -> decisions`, `responsible_role text`, `diagnosis jsonb`, `created_at timestamptz`.

- ai_v2 六表 RLS 均已啟用，已撤銷 public/anon/authenticated 直接存取。
- ai_v2 沒有被設計為公開 Data API schema。
- 已驗證有六條外鍵約束；詳細 check/unique/index 見 SQL 原始檔。
- **資料表建立不代表 AI 引擎已實作。**

## 資料筆數：2026-10-17 回補前的查詢快照（非持續即時）
| symbol | raw_candles | market_features |
|---|---:|---:|
| BTCUSDT | 139450 | 138650 |
| ETHUSDT | 139451 | 138651 |
| SOLUSDT | 0 | 0 |
| BNBUSDT | 0 | 0 |
| XRPUSDT | 0 | 0 |
| DOGEUSDT | 0 | 0 |
| PENGUUSDT | 0 | 0 |

最早 200 根暖機導致指標筆數比原始資料少；正式驗收需按每個商品/週期逐項核對，不能只比較總數。

## 待補足的精確欄位備份
`raw_candles`、`market_features`、`ingestion_jobs`、`data_quality_issues` 的 column name/type/default/constraint 尚未完整備份。應於下次 metadata 查詢可用時，以 `information_schema.columns`、`pg_indexes`、`pg_constraint` 的**唯讀查詢**補充，不得為了文件而修改表。
