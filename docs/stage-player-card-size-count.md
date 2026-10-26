# 2026-10-27 角色立繪、公開手牌數與重複角色說明修正

## 使用者真機觀察
- iPhone 直式：上方戰況面板底緣覆蓋中央角色頭部。原生 #arena 座標、比分板與 native player transform 分別縮放導致固定偏移不穩定。
- 各玩家手牌數原生 `player.node.count` 的 `張數／上限` 只有很小文字，在角色照片旁辨識困難。
- 長按角色可以開本站完整圖片+技能閱讀視窗，**但原生 noname 還在 500ms 顯示灰色文字量很大的舊 intro**。此前只消除了長按手牌的原生雙框。

## 改動與安全
1. 只在可操作的直向手機／iPad，使用 `scoreboardSeatShift` 比對實際比分板底端與每個對手的角色頂端，算 14px 安全間距，最高移動 68px。扣回上一幀的 translate，避免 HUD 400ms 更新造成跳上跳下。CSS individual `translate` 與 native transform 互不覆蓋；不更動角色順序或觸控目標選取事件。
2. 角色原本 DOM 的視覺放大僅直向 6%、較寬且非極短橫向 3.5%。不複製角色、不重建手牌、不更換底層定位和座位。
3. 調整**原生** `player.node.count` 外觀：在卡角固定顯示「牌 3/6」這類高對比讀數，含 15px（手機直式16px）數字、清楚背景與邊框；仍由引擎更新且只顯示公開總數／上限，沒有讀取他人的隱藏卡牌身分。
4. 在 `grail-detail-view.js` 的文件 bubble touchstart 中，若是**可公開檢視的玩家角色、選角角色或自己手牌**，取消原生 `ui.click.longpresscancel.call(subject)` 的 500ms 文字 intro 計時器，保留本站 580ms 的完整角色卡+技能視窗；不干擾點擊選角、出牌、選目標或隱藏人物。桌面右鍵公開角色也改走本站閱讀視窗。
5. 新增原生 intro 去重、隱藏角色不可偷看、公開手牌數 CSS、直向 400ms 穩定讓位測試。

## 邊界
- 先保持現有 Card DOM 與 hit-testing，不對高密度短橫式座位強行放大；不同玩家指示物跟隨 getBoundingClientRect 更新。
- 實體 Safari 尚需驗收照片及分數條的安全間距、手牌數的可讀性、長按是否只開一個。
- 房主模式、完整角色引擎技能、Cloudflare 免費相容 Workers/DO 以及 Vercel 維持原狀。
