# 2026-10-27 iOS Safari 目標線旋轉與長按檢視共存

- 已知的金色攻擊／冰藍法術連線先前更新於 click/pointerup/touchend/window.resize 和每400ms HUD 更新。Safari 縮回網址列、手牌橫向滑動、visualViewport.resize/scroll 未必觸發 window.resize，線段可能短暫滯留。
- 加上 document scroll/visibilitychange、window orientationchange/pageshow、visualViewport resize/scroll，仍以 requestAnimationFrame 合併重複刷新；使用最新 getBoundingClientRect 更新每條已選目標線，絕不修改原生 ui.selected 或出牌步驟。
- 展開 #grail-detail-overlay（完整卡牌／角色說明）或 iOS 網頁進入背景時暫時清掉 SVG；關閉說明／回到前景後只按有效原生選取恢復，不顯示舊攻擊線。
- stop() 移除所有新增監聽，已排程動畫幀由 stopped 保護。回歸測試涵蓋 390×844 → 844×390 旋轉、手牌 scroll、隱藏視窗與返回及監聽釋放。
- 對戰規則、牌庫、連線房主、Cloudflare 免費方案相容配置與 Vercel 均保持不變。自動測試不能取代 Safari 真機驗收。
