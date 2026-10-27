# 2026-10-27 iOS Safari 共用 HUD 定位穩定性

影響範圍：手機／iPad 角色旁手牌數、聖盾／水晶狀態列、戰況提示、完整卡牌閱讀視窗共用的 `grail-viewport.js`。此前僅在 body style mutation、window.resize、visualViewport.resize 重算反向縮放與定位；Safari 地址列收合、visualViewport.scroll、旋轉與 bfcache 恢復可能只觸發其他事件，導致 HUD 短暫錯位。

此次補上 window.scroll、orientationchange、pageshow、visualViewport.scroll 及 fullscreenchange，並以 requestAnimationFrame 合併連續事件，避免一次旋轉寫入多次位置。尺寸及反向縮放仍依原本非引擎改動的 getBoundingClientRect/offsetWidth 計算，僅在 scale 實際改變時更新 `--grail-touch-scale`，減少額外重排。關閉／卸載時拆除所有事件及取消尚未執行的動畫幀。

新增模擬 390×844 → 844×390、非零 body offset、地址列滑動、pageshow、fullscreenchange、同幀事件合併和清理測試。

未改角色 1.38/1.22 放大比例、noname 遊戲規則、多人房主邏輯、Cloudflare Workers 免費相容方案或 Vercel。以上是可測的事件與幾何修正，尚需真機 Safari 視覺驗收。