# P4 診斷研究：下一次可重現執行（2026-10-19）

## 狀態
- **READY_FOR_MANUAL_DISPATCH**：研究尚未執行；不可記為模型已學習。
- GitHub Actions: `.github/workflows/p4-diagnostic-research.yml` → **Run workflow**。
- 使用既有的 `p4-research` environment secrets；不在文件或瀏覽器暴露 Supabase service role。
- 只允許 `RESEARCH_ONLY`；沒有實際下單、模型升級或 Champion promotion。

## 經 Supabase 唯讀查核的 BTC 1h 歷史區間
- `job_id`: `p4_diag_entry_priorwindow_2000_20261019_01`
- `from_ms`: `1777903200000`（2026-05-04 14:00 UTC）
- `to_ms`: `1785099600000`（2026-07-26 21:00 UTC）
- `as_of_ms`: `1785106800000`（最後一根 K 線結束之後）
- `actor`: `Entry`
- Supabase `public.raw_candles` 查核：BTCUSDT 1h 在該區間共 2,000 筆，2,000 個不同 open_time，起訖相符。
- 此區間早於前一筆 `p4_diag_entry_2000_20261019_01` 的研究視窗；**不重疊不等於未曾見過的獨立 OOS 驗證**。只用於程式整合驗收及額外歷史研究。

## 執行與驗收
1. GitHub → Actions → **P4 diagnostic research (manual only)** → Run workflow → 填入以上五個值。
2. 確認工作流程完成；若失敗，先查 Actions logs，不要改用相同 job_id 覆寫。
3. 以唯讀 SQL 檢查新研究摘要：
   ```sql
   select job_id,
          summary->>'status' as status,
          summary->>'loadedCandles' as loaded_candles,
          summary->>'oosEvidenceStatus' as oos_evidence,
          summary->'learningEvidence' as learning_evidence,
          summary->'followUpPlan' as follow_up_plan
   from public.p4_diagnostic_research_summaries
   where job_id = 'p4_diag_entry_priorwindow_2000_20261019_01';
   ```
4. 確認 `ordersEnabled=false`、`modelUpdateApplied=false`、`championPromotionAllowed=false`，且研究結果不是單憑 train 表現就認定改善。
5. 如果 OOS 交易數不足，結論必須是補充證據；不可將舊區間重複測試宣稱為獨立驗證。

## 後續
新的前向、未參與調參的資料到齊後，再進行獨立 OOS；未通過前保持研究狀態。
