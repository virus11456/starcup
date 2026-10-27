# 2026-10-27 選角進入對戰時狀態 HUD 零尺寸防護

原本 `createPlayerIndicators.update()` 在沒有可見角色（如選角階段）時會將 `#grail-player-indicators` 設為 `hidden`；正式開局第一個 update 嘗試生成公開手牌數、聖盾、水晶時，卻在把上層容器恢復顯示**之前**讀取 strip.offsetWidth/offsetHeight。Safari 對 display:none 後代必然回傳零尺寸，因而採用估算值，可能導致第一畫面錯判不夠空間、首回合牌數短暫消失或標記誤位。

本次在有公開角色可呈現時，同一個同步 update 一開始先解除 layer.hidden，量測實際子元素後才照原本完整／精簡版演算法定位；最後仍以 `layer.hidden = strips.size === 0` 決定是否保留顯示。無角色／選角／全部狀態均放不下時仍會隱藏 HUD、恢復原生手牌計數，沒有改動 native 玩家或其碰撞目標。

新增 Fake DOM 回歸：模擬選角 -> 進入正式對戰，offsetWidth/Height 只有在 parent 可見時才可讀，驗證沒有再量到 display:none 的 0、公開計數鏡像成功、停止時恢復。沒有更動 Cloudflare DO 房間、完整技能、房主模式或 Vercel，免費相容設定保留。實體 Safari 後續仍需驗收。