# 2026-10-27 特殊攻擊卡金色呼吸光修正（待整合部署）

依星杯對話的需求，只有目前角色真正持有的印刷獨有攻擊技能，其對應手牌顯示金色邊框；角色更換、暗牌、離開手牌仍由既有 `grail-card-skin.js` 即時清理。原有 CSS 已設定 2.6 秒呼吸動畫，但在 `::after` 基底同時以 `opacity: 1 !important` 和 `box-shadow: ... !important` 宣告動畫屬性。CSS cascade 中 important 宣告優先於 keyframe，導致呼吸強弱實際不會改變。

本階段只修裝飾樣式：去除 `opacity` 的 important 宣告，改用 `opacity: .58` 到 `1` 的往返動畫。金框、遮住圖片時可見的內圈、選取時青綠外圈、長方形牌比例與點擊目標均保留。移除逐幀動畫陰影，減少手機、iPad 的重繪成本；`prefers-reduced-motion: reduce` 保留靜態明亮金框。

## 驗證

- 讀取公開 Cloudflare 正式單人牌局的 CSSOM，確認線上版本載入 `grail-special-gold-breathe`，同時 `opacity` 與 `box-shadow` 為 important，重現根因；這**不是**新版的線上視覺驗收。
- 本機 `tests/card-skin.test.mjs`：15 項中 14 項通過，失敗的唯一案例需要 `public/engine/character/shiZhouNian.js` 生成輸出；本次改動的金光動畫回歸測試通過。
- 本機 `tests/viewport.test.mjs`（2 項）、`tests/player-indicators.test.mjs`（21 項）通過，PostCSS 解析及 `git diff --check` 通過。
- `npm test`（16 個應用測試檔）及 `npm run typecheck` 通過。
- `npm run prepare:engine` 因 `codeload.github.com` DNS `EAI_AGAIN` 失敗（含核准的網路執行），無法完成 `verify:local` 或建置並以新版瀏覽器檢查 iOS/桌面。不要把單元測試等同實機驗收。

## 發布狀態

此為非部署的開發階段。沿用 `cloudflare-migration` 的最新 HUD/Safari 修正，不更動 Vercel、Cloudflare 站台、資料庫、卡牌規則或多人房主架構。Cloudflare 管理端查詢未取得授權，正式部署與新版瀏覽器驗收尚未執行。整合發布前重新執行 `npm run verify:local`，並在 390px 直式、844×390 橫式、768px 平板與 1440px 桌面檢查實際獨有攻擊手牌未選取時會持續呼吸、選取後仍可辨識。
