# 2026-10-27 公開狀態列避開真正手牌與上層操作

## 根因
新版已能避開角色放大後的立繪與比分板，但把 `ui.me.getBoundingClientRect()` 當成手牌範圍，實際上那是自己的角色節點，**不是底部 `#handcards1 .handcards` 手牌展開區**。此外遊戲純文字行動提示、牌堆／棄牌按鈕、回合紀錄及說明工具尚未參與每400ms狀態列的碰撞判斷，可能讓橫向狀態 chip 壓住手牌或提示文字。

## 本次修正
- 從原生手牌容器 `#arena #handcards1 .handcards`／`ui.handcards1` 的真實 `getBoundingClientRect()` 取得避讓範圍，不再用本人的角色卡替代。
- 加入公開 `#grail-phase-hint`、`.grail-motion-piles`、原生牌堆與棄牌鍵、回合紀錄、說明以及浮動選單的可見矩形。
- 實際 `hidden`、原生 `.hidden`、`display:none`、`visibility:hidden`、`aria-hidden=true` 或零尺寸/無 client rect 的項目不阻擋定位。對重複參照的同一按鈕去重。
- 保留完整狀態標記優先、放不下時水平手牌數優先；每個候選仍要避開角色、玩家控制、上方戰況列和螢幕邊界。所有 UI 只讀且 `pointer-events:none`，不改引擎出牌與角色點擊。
- 補測試涵蓋手牌與原生角色混淆、行動提示、牌堆重複參照、隱藏工具、以及提示與手牌數不重疊。

## 驗收
需要 iPhone/iPad Safari 真機，尤其 4/6/8 人連續多次技能選擇與右側角色公開標記。程式與 Cloudflare 建置成功只是自動測試驗收。未修改房主、遊戲牌序、Cloudflare 資費或 Vercel。