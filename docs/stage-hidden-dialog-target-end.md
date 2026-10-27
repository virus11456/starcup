# 2026-10-27 防止舊遊戲提示／結算殘留的輕量穩定性修復

### 原生引擎行為
noname 的 `Dialog.open()` 對較早的原生對話框呼叫 `hide()`，而 UI 每 400ms 以 DOM 查詢 `:scope > .dialog:not(.popped)` 搜尋提示。**DOM 查詢仍會包含隱藏的舊 dialog**，可能讓階段文字倒退或顯示一則過期提示。

### 修正
- 新增 `isActionDialogVisible`，只鏡像當前顯示的原生純文字提示；跳過 hidden/removing/unfocus/inline display:none/aria-hidden 的舊對話框，並清除其過期裝飾類別，不更改其內容、行為或觸控。
- 攻擊／法術目標 SVG 在引擎 `_status.over` 時清除；取消、重新選擇及普通遊戲階段維持原生 `ui.selected` 作為判斷，既不干擾選取也不讀取對手手牌。
- 新增被隱藏的舊提示不得覆寫新提示、不同隱藏狀態、結束後不得留攻擊線等回歸測試。

### 範圍與驗收
只調整現有免費 Cloudflare Worker 靜態引擎前端，不更改儲存 schema、遊戲勝負計算、房主方式、Vercel。自動化測試與 Cloudflare 版本部署必須成功；iPhone/iPad Safari 的視覺確認仍需要實機。
