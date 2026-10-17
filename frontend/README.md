# P1 前端控制中心

深色、全繁體中文、iOS 優先。**管理員使用帳號 guber + 密碼登入，不要求個人電子郵件。**

## 啟動
在 frontend 目錄執行 `npm start`，Node.js 20+，預設 8080。

## 後端必要環境變數
- `SUPABASE_URL`：Supabase 專案網址
- `SUPABASE_PUBLISHABLE_KEY`：公開金鑰（不可使用 service_role）
- `ADMIN_USERNAME`：`guber`
- `ADMIN_AUTH_EMAIL`：僅供 Supabase Auth 內部識別的非個人帳號別名，不是使用者電子郵件

後端將帳號名稱映射到內部 Supabase Auth 身分。需由具管理權限的安全流程先建立該 Auth 身分及設定密碼；**不得把使用者密碼寫入 GitHub 或環境變數**。目前尚未完成身分開通與實際登入驗收。

## 安全
- 前端預設必須登入，未登入不顯示控制中心。
- 不在前端提供密碼、內部帳號別名或管理金鑰。
- Supabase 的 RLS 仍是資料授權最終防線；目前尚未完成管理員角色專屬政策與負向測試。
- `frontend/data.js` 為行情只讀接入層，需再完成安全配置和連線驗證。

## Logo
使用者提供的完整馬頭與 UBER 字樣原圖須存入 `frontend/assets/uber-logo-original.jpg`，不可替換圖形或改變構圖。目前尚未加入二進位資產。

## 未完成
管理員 Auth 身分建立、權限與 RLS 驗收、公開金鑰及內部別名部署配置、Logo、iOS Safari 實測、Railway 前端服務及正式部署。不得宣稱 P1.1 或 P1 已完成。


## 部署品質門檻

Railway 前端服務已設定 `npm test` 為建置指令；未通過 `server.test.mjs` 安全冒煙測試時不得視為新版本已驗收。健康檢查為 `/api/health`。管理員內部身分未設定時，服務可以啟動，但登入及受保護的行情查詢必須拒絕。
