# 手機版自己手牌數顯示歸屬修正（2026-10-28）

使用者在 Cloudflare v60 的 iPhone 直式四人局截圖指出，一個「手牌 4/6」公開指示物被放到牌桌中左方的空曠位置，遠離擁有它的左下角己方角色，因此無法看出是哪個玩家的手牌。

## 原因
目前 `createPlayerIndicators` 將**所有玩家**的原生公開手牌數（`player.node.count`）複製成獨立 HUD 狀態晶片，再依全畫面無碰撞位置選出放置點，候選位置甚至會沿遠方空白行／列滑動；自己的手牌扇面是障礙物，容易迫使自己的晶片漂離角色。原生 count 被 `data-grail-hand-count-mirror=true` 同時隱藏，使角色旁找不到對應數字。

## 修正（僅表現層）
1. 只有 **600px 以下直式、`player===game.me` 且 `data-position=0`** 的目前玩家：不再額外鏡像公開手牌數到可任意漂移的指示物圖層，而是直接保留它的**原生 count 節點**；透過 CSS 給原生數字一個位於自己角色卡上方、標明「我的手牌」的標籤。僅讀 native `4/6` 文字，不查閱對方私牌，不改原生資料。
2. 對手、隊友的手牌數顯示與其角色旁標示維持既有邏輯；自己的其他公開狀態（聖盾、封印等）仍照常顯示。
3. 轉橫式或桌面不套用上述定位，維持原本的 HUD；保留可點的原生角色、牌堆、技能與手牌，沒有更動任何 Noname 遊戲規則。

## 驗證
- `tests/player-indicators.test.mjs` 確認只有真正的自己、手機直式才保留原生標籤；角色旁公開卡牌數的來源仍是原生公開 count；不更動其他玩家的流程。
- `scripts/check-browser-layout.mjs` 自然開啟 390x844 六人局並選角後，量測實際原生 count `boundingClientRect`，確認「我的手牌」在自己角色上方且不再於 HUD 中漂浮。
- `npm run verify:local` 必須成功（完整角色規則對照、Cloudflare 運行環境、HTTP、型別、Chromium）；符合後才合併 Cloudflare。

進階 iPhone Safari 狀態標示碰撞仍由 Issue #8 與獨立 Draft PR #10 追蹤，這個具體的手牌歸屬修正不應被誤宣稱可解決所有不同手機跑版情形。