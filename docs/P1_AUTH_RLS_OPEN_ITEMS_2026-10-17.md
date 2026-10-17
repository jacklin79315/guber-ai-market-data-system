# P1 權限驗證待辦

檢查日期：2026-10-17。

- 前端已新增登入狀態提示，未開通管理員時顯示無法登入。
- `market_data_watchlist` 目前沒有 SELECT RLS policy；現有使用者權杖無法取得監測清單，必須在確認管理員 UID 後設定限定身分的唯讀權限。
- `raw_candles` 的 SELECT policy 目前適用所有 authenticated 使用者，日後應評估縮小範圍。
- 不使用 service_role 金鑰作為前端資料讀取的捷徑。
- 管理員身分與登入端到端驗收尚未完成。
