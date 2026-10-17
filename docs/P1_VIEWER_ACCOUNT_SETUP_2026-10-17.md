# 一般帳號啟用設定（P1）

目前已加入一般帳號的唯讀登入路徑，但尚未建立任何一般帳號，也未啟用資料庫讀取權限。

## 後端設定

Railway 可使用 `VIEWER_AUTH_USERS_JSON` 指定一般帳號與既有 Supabase Auth 身分的明確對應。格式範例：

```json
[{"username":"reader01","userId":"<AUTH_USER_UUID>","email":"<INTERNAL_AUTH_EMAIL>"}]
```

使用者只輸入 `reader01` 與密碼。內部 email 只供後端對 Supabase Auth 驗證使用，不是對外登入名稱。後端不儲存明文密碼。

## 安全邊界

- 僅有設定的帳號可登入；身分必須同時符合 Auth user ID 與 email。
- 未知角色與未授權操作預設拒絕；viewer 沒有訓練、模型、使用者及系統管理權限。
- 市場資料使用登入者 JWT 查詢 Supabase PostgREST；資料庫 RLS 仍必須單獨授權，後端映射不會繞過 RLS。
- `market_data_watchlist` 尚未設定 SELECT RLS，因此一般帳號的監測清單尚不可用。
- 既有 Auth 使用者不做變更；不自動建立、升級或授權任何既有帳號。
- 帳號管理頁、停用帳號及完整登入端到端驗收仍待開發。
