# 手機星石選擇修補

提煉與合成保留原生選取及資源轉移規則，只調整視窗、說明、星石按鈕與確認列的位置。手機直向預留手牌及操作列空間；短橫向使用獨立戰況、角色、選擇與手牌列。

本機驗證：48 項應用測試、48 項引擎測試及 TypeScript 檢查通過。Next.js 正式建置在此工作環境因 Node `process.memoryUsage()` 回報 `uv_resident_set_memory ENOENT` 中止；獨立呼叫該 Node API 也出現相同錯誤。正式建置結果需由 Vercel 的 Git 部署驗證。

此修補不包含 Cloudflare 後端或資料庫遷移。保留 Vercel，待 Cloudflare 的完整多人驗收完成後再處理移除。
