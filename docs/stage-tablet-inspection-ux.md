# iPad／桌面選角、行動提示與卡牌閱讀：UI/UX 階段

此階段沿用使用者指定的 [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) 設計規範；以保留 noname 原生的選牌、目標、技能按鈕及座標系為優先。

## 已實作

- `grail.css`：桌面與 iPad 的角色選擇視窗加寬、可捲動、卡片間距增加；只有不含選項卡的純文字行動提示縮成上方窄面板，避免遮住血量。真正有互動選項的對話框維持原位。
- `grail-role-tags.css`：選角卡增大；長角色名在個別卡片內橫向換行，不再以原引擎的直排字覆蓋相鄰卡片。保留角色定位／半星難度。
- `grail-detail-view.js`、`grail-inspection.css`：點一般公開角色顯示大圖＋技能／公開指示物；目標正可選時保留原生點擊，長按同樣可看說明；長按己方實體手牌（桌面亦可右鍵）顯示放大牌面和完整效果。iPad 橫向左右分欄，手機直向上下排列；不讀取對方手牌或隱藏狀態。
- `index.html`：保留 viewport 裝置寬度，不阻止使用者縮放文字與內容。
- `tests/inspection.test.mjs`：角色與己方卡牌資料、隱藏狀態隔離、可選目標原生點擊及長按不出牌測試。

## 驗證與部署邊界

- 使用 `npm run verify:local` 做應用程式、Vinext Worker、引擎、Cloudflare SQLite/WebSocket、型別及 HTTP 存取測試；不使用正式 Durable Objects 做重複性測試。
- 真正的 iPad Safari 螢幕視覺／動作驗收仍需在部署後用 1024×768、768×1024、桌面 1440×900 與 390×844 測試。單元測試不代表已目視確認每個斷點。
- PWA 已有 manifest、圖示、iOS 加入主畫面與安裝提示；遊戲仍須連網，不宣稱離線可玩。
- 角色本人專屬攻擊牌金框已由先前 Cloudflare 發布實作；本 UI 變更不調整該牌的條件或遊戲平衡。
- 不啟用任何新增付費 Cloudflare 產品，不碰 `main`／Vercel，直到搬遷驗收完成前不刪除 Vercel。
