# 2026-10-27：手牌中央異常空位（開發階段，未部署）

## 依據與侷限
使用者桌面截圖中，自己顯示「手牌 5/6」，但只看到四張牌；四張牌位置大致為 x=194、305、527、638，第三格 x≈416 留空。這與原生 `ui.updatehl()` 以固定約 112px 間距平移手牌的排法相吻合。

釘選 Noname `noname/ui/index.js` 的 `updatehl()` 會移除本地牌節點的 `drawinghidden` 類別並重算每張牌的 transform；原生 `layout/default/layout.css` 令 `.drawinghidden` 牌透明。因此一張卡若錯過動畫結束後的 native layout refresh，有機會仍佔著牌位、卻不顯示。**這是根據截圖及原始碼提出的原因假設，尚未在出現問題的真實瀏覽器 DOM 重現並確證。**

## 修復內容
- 在既有 `grail-bridge.js` 每 400ms 的 UI tick 裝入 `grail-hand-visibility.js`，只監看 `game.me.getCards('h')` 中實際位於原生兩個手牌容器內的卡片，沒有讀取其他玩家私有資訊或卡面資料。
- 若 `drawinghidden`、零透明度、`display:none` 或 `visibility:hidden` 持續超過 **1200ms**，只呼叫一次原生 `ui.updatehl()` 進行視覺位置重算，不新增、重建、抽取、棄置或重新排序卡片。
- 忽略原生 `removing`、`infohidden`（資訊遮蔽）及 `hidden_handcard`（整個手牌展示遮蔽），以及角色選擇、原生容器尚未齊備的狀態。
- 對於渲染仍異常但不屬於上述類別的情況，維持原樣並要求保留 DOM 診斷；**不強制取消引擎合法的隱藏或動畫狀態**。

## 回歸
- `tests/hand-visibility.test.mjs` 涵蓋 1／2／4／5／6／10 張正常手牌、第三張 `drawinghidden` 滯留、樣式不透明、兩個原生容器、合法的遮蔽牌、離場牌、非己方節點、抽牌動畫過程、重複觸發及未初始化布局。使用隔離 Node 模擬測試通過 **7/7**。
- 未在當前執行環境跑完整 `npm run verify:local`；原始碼位於已部署基礎 `work/deploy-verified-20261027` 的後續開發分支，釘選引擎套件／完整工作區在目前環境無法重新下載。**不能將 mock 測試稱為真實手機或多人驗收。**

## 發布前必要驗收
1. 在 1324×844 桌面重現 5/6→可見 5 張且可選棄（尤其第三張），記錄 DOM 中實際卡節點數、class、computed opacity 和 rect；若是另外原因，優先修正該原因而非擴大解封所有隱藏牌。
2. 依據完整 `npm run verify:local`，再於 390px 直式、844×390 橫式、1440px 桌面操作 1–10+ 張牌、抽牌動畫、手牌選擇、棄牌、重連及多人同步。
3. 持續驗證原始角色技能、牌序、手牌數、資源與棄牌結果沒有變動，再合併部署。

此階段**不動主分支，不部署 Cloudflare，不變更資料庫或遊戲規則**。