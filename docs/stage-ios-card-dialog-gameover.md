# 2026-10-27 Safari 卡牌長按與結算圓形選單修復

- 實機 iPad 直式、橫式：長按一張卡時，同時顯示原生灰色說明及本站新的整張卡＋完整效果視窗；新版視窗圖片與說明也因引擎全域 `div { position: absolute; }` 而重疊。
- 原生 `noname/library/index.js` 的 `setLongPress()` 在原卡片 touchstart 加入 500ms `ui.click.intro` 計時器；本站長按預覽 580ms，故原生視窗會先出現。
- 在**文件 bubble 階段**偵測自己持有且已公開的手牌觸碰，執行原生 `ui.click.longpresscancel.call(card)` 清除原版長按說明計時器。此函數不修改卡片選取、手牌、事件結果，也不 `preventDefault` 或攔截點擊。放大視窗在 580ms 仍正常出現。清理時移除事件處理器。
- `grail-inspection.css` 強制新預覽容器內結構性 `div` 恢復 `position:static`，但整頁遮罩、畫像、金框文字標籤保持設計定位。iPad 直式<=1100px「圖片上方／技能文字下方」，短橫式使用左右雙欄並限制畫像高度。
- 結算時原生 `#roundmenu` 不再蓋住傷害／受傷等統計：依引擎 `_status.over` 增減 `html.grail-match-ended`，只隱藏原生懸浮圓形工具，不遮蔽結算對話框、重新開始按鈕或戰況統計。放大預覽出現時也將其藏於遮罩下。
- 測試包括原生與新版長按共存、Hidden卡保護、正常點擊不中斷、CSS Flow、結算浮動鈕顯示條件與清理。
- 保留房主模式、完整 noname 技能、Cloudflare 免費相容設定，不動 Vercel。實體 iPhone/iPad 仍需重新驗收。
