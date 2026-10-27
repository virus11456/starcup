# 2026-10-27：統一首頁視覺、修正回合按鈕與被遮擋的牌桌提示

## 使用者截圖及設計目標

1. 首頁採深海藍綠底、暖金色字與卡片外框；`/full` 與 `/online` 使用獨立背景、舊版頂欄，寬螢幕時還有全域 `main` 最大寬度，導致外側邊帶色彩不一致。以首頁為基準統一**一般站內頁**。牌局進行中的原生 iframe/安全離開牌局控制不變。
2. 右下方 `取消` 在最後的可選行動其實使回合結束，應明確呈現「結束回合」；若還有其他正常行動則顯示「略過本次行動」，技能選擇或其他原生取消繼續顯示「取消」，回應攻擊時原 `cancel` 承受傷害。
3. `承受傷害` 文字被裁切：原生 `Control.replace()` 依短字「取消」寫入固定 `style.width`；客製文字替換後並沒有重新量測。修正只重新測量原生 childNodes 的 `offsetWidth`，更新容器寬度並呼叫原生 `ui.updatec`，保留 `link='cancel'` 及全部原生事件。
4. 大型 `#grail-phase-hint` 浮層可能蓋住人物、卡牌或確認按鈕；改為嵌在固定戰況條標題的簡短提示，舊的懸浮面板 CSS 停用。打開原生選單時暫隱與之衝突的 HUD。不移除可操作原生對話框。
5. 風之劍聖「風怒追擊」在沒有風系攻擊牌時仍被顯示：原引擎技能 `filter` 僅限制主動攻擊結束；`check` 的手牌檢查供 AI 決策。不得強行加入缺牌禁止條件。改稱「符合發動時機的技能」，在本地手牌確實無風系攻擊牌時補充提醒：「依原規則仍可發動，但額外攻擊可能無牌可用」。提醒只存在個人輔助說明，不洩漏其他玩家手牌，也不介入結算。

## 修改檔案

- `app/globals.css`：新增首頁一致的共用色票與背景 token。
- `app/portal.css`：首頁、學院與卡牌／規則頁共用漸層背景。
- `app/full/full.css`：解除 `/full`、`/online` 非對戰頁最大寬度限制，背景填滿視窗；統一標題、間距、卡片、按鈕和金色點綴。
- `app/full/page.tsx`、`app/online/page.tsx`：未入局時共用 `SiteHeader`；真正入局時仍保留原生安全操作列與離開確認。
- `vendor/noname/overrides/grail-bridge.js`、`grail.css`：被動提示縮進戰況列，移除會遮擋牌桌的提示大框；缺風系攻擊牌只提供資訊提醒。
- `grail-response-labels.js`、`scripts/prepare-engine.mjs`：修正不同取消含義的文字與原生寬度重算，沒有更換 native click handler。
- `grail-skill-readiness.js`：純顯示邏輯，使用本地 `getCards('h')` 判定提示，永遠不影響技能可選性。
- `tests/action-hints.test.mjs`、`tests/response-labels.test.mjs`、`tests/skill-readiness.test.mjs`：來源及單元回歸。

## 發布守門條件

- GitHub Actions / 本地完整 `npm run verify:local` 須成功：釘選引擎與規則一致性、build、runtime/SQLite/WebSocket、TypeScript、64 項 HTTP 檢查。
- 另須於桌面、390px 直式及 844×390 橫式**實際瀏覽器**檢查首頁→單人入口、多人入口、遊戲／教學／卡牌與規則頁、選單及回應按鈕；`承受傷害` 四字完整可見，對局提示不遮住角色／可選手牌／控制。
- 成功才合併到 `main`，核對 Cloudflare 新部署；失敗保留分支且不部署。

**保護事項**：原始技能 `trigger/filter/cost/content`、已撤回的七項前置限制、每回合行動、寶石／水晶、所有選擇結果及牌局勝負邏輯一律保持原樣。
