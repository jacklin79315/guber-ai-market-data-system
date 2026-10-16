# P1 前端控制中心

目前為深色繁體中文、iPhone 優先的靜態網站。前端程式放在本目錄。

啟動：在 frontend 目錄執行 `python3 -m http.server 8080`。

安全登入預設關閉：請於 `config.js` 填入 Supabase 網址及公開金鑰（publishable key），絕對不可使用 secret 或 service_role 金鑰。未設定時頁面只顯示登入提示，不開放控制中心。

原始完整品牌圖檔需放在 `assets/uber-logo-original.jpg`。目前 GitHub 尚未包含該圖片，禁止使用替代圖案。

已實作：中文導覽、響應式深色版型、登入會話基礎、七商品原生 K 線只讀資料介面。

未驗收：管理員授權、帳號建立、金鑰設定、實際登入與行情連線、iPhone 實機測試、Railway 前端部署。不得宣稱已正式上線。
