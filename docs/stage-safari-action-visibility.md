# 2026-10-27 Safari 行動提示與選角陣營標籤修正驗收清單

## 來源與範圍
使用者的 iPhone 直向及 iPad 橫向截圖顯示：遊戲中央空白提示框佔位、行動文字不易看清；選角卡右上陣營標籤（例如「神聖教廷」「鮮血議會」）溢出或被裁切。這些是 UI 顯示問題，不修改規則、連線資料或技能。

## 修復清單與驗收標準
- **P0—純行動提示辨識（`grail-action-hints.js`、`grail-bridge.js`）**：只在原生 `.dialog` 沒有卡牌、選項、按鈕或可編輯元素，且具有 `.caption`／`.prompt` 時標為 `.grail-action-hint`。不得移動應戰、技能和選牌等有互動的對話框。原生遊戲的節點與事件處理保持原狀。
- **P0—文字可見性（`grail.css`）**：提示文字強制明亮前景、Safari `-webkit-text-fill-color`、水平閱讀、清楚字級／行高；移除之前過廣的 `:has(.caption, .prompt)` 對話框樣式。
- **P0—空提示列（`grail-action-hints.js`、`grail.css`）**：沒有非空白文字時加上 `.grail-empty-action-hint` 隱藏整條；同一節點後續出現文字時要在下一輪更新恢復。測試覆蓋一般空白與不斷行空白。
- **P0—血量與目標可見性（`grail.css`）**：非互動提示縮成牌桌上方靠左、較短且不擋點擊的小提示；iPhone／iPad／桌面使用各自寬度與比例，保留原生目標點擊區。
- **P0—選角陣營標籤（`grail-role-tags.css`）**：原生 `.button.character > .identity` 和子節點統一改為卡片內絕對定位、水平字、可換行，保留行動選擇；避免超出卡片的標籤被 `overflow:hidden` 截斷。檢查「神聖教廷」「鮮血議會」「詠歌城」。
- **P1—回歸（`tests/action-hints.test.mjs`）**：有字→可見；沒字→隱藏；從空白更新為有字→恢復；互動視窗／選角視窗→不改動；檢查 Safari fallback 樣式與陣營標籤的卡內定位。

## 驗收狀態及界線
程式回歸測試交由 Cloudflare 原本 CI 進行；不需開啟正式多人房間或修改正式 DO 資料。本機／CI 程式測試不能代替使用者實體 iPad 和 iPhone Safari 顯示檢查。真機請測 iPhone 直向，iPad 1024×768 橫向及 768×1024 直向，桌面 1440×900，並確認行動提示在有字／無字／技能選擇三個情況都正確。
Cloudflare 服務仍僅使用現有免費方案相容的 Worker、Static Assets 與 SQLite Durable Objects；未授權升級付費或刪除 Vercel。
