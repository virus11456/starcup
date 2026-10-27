# 2026-10-27 iPhone 實機回報：避免遮中央角色、頂部六按鈕一致、手牌未選金框
- 非互動提示在手機縮成左側最多36%（平板窄畫面37%）的可換行字塊。保留中央角色、血量、原生目標與選擇視窗的位置。無文字仍隱藏。
- 原生選項、暫停、託管按鈕共用 44px 高度、8px圓角、13px字級、背景和邊框；未縮放 HUD 的「本場紀錄」「說明」同設計；原生牌堆鍵只加 class 不重建、不接手點擊事件。
- 印刷專屬攻擊的手牌匹配優先使用 lib.card[card.name].type，其次 native get.type(card,false)；不受暫時牌型修正或初始化影響。only local getCards('h') and not infohidden; use 3px border + always-visible topmost pointer-events:none ::after gold ring. 普通牌不變。
- 金框不以 .selected 或 .selectable 為條件；各人印刷技能需與自己固有技能相符。引擎規則不動。
- 新增 CSS 和原生卡牌匹配測試；Safari 真機仍待用新牌局確認。Cloudflare 免費相容，Vercel 不變。
