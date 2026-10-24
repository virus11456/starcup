# 目前部署狀態

更新日期：2026-10-25（UTC 2026-10-24）。歷史十局紀錄另見 game-test-report-2026-10-25.md；本次驗證見 [本次測試報告](qa-update-2026-10-25.md)。

## 最新：沿用上游引擎的介面更新

- 開發依據與分工見 [架構說明](architecture.md)：無名杯仍是實際規則引擎，Codify 作為狀態機／隊伍資源對照，未重寫引擎或部署 C++ 伺服器。
- 最新功能提交：`1d44250b724d3ca26628e1b184c237c37ade505a`（包含 `8dc5608` 介面更新及 `03ed372` 版面修正）。Vercel 正式部署 `dpl_31mFMu9Y2VUVGcGUXEGuceAsuGYw` 已 READY，Git source 為 main，原正式網域已指向此版本。
- 首頁主要入口改為角色與擴充對戰；保留核心多人房間。選局介面、角色卡展示、公開戰況與行動／回應提示、可選／已選輪廓已更新。
- 修正未定義字型變數、手機 iframe 高度、原引擎 arena 超界和 focus 導致的隱藏容器捲動。保留原本 body 縮放與點擊座標系；手機控制按鈕依縮放補償後實測為 44px 高。
- 30 項核心測試、19 項引擎／顯示測試、TypeScript 與 diff 檢查通過。本機 build 受宿主 `uv_resident_set_memory` 不可用影響，正式 Next.js build 已由 Vercel 成功完成。
- 瀏覽器實際檢查：首頁入口、角色圖鑑直達、4／6／8 人設定、選角與座位、出牌選目標、傷害抽牌、隊伍戰績更新；桌面 1470×681 與手機 390×844。最終版手機選角確認後 arena 及所有四個角色均在視窗內，容器 scrollLeft／scrollTop 為 0。
- 此次為操作與版面回歸，不是全角色裁定驗收，也不是實體手機測試。完整擴充仍為本機對 AI，跨裝置多人尚未接入。

以下保留上一輪發布紀錄，非最新功能版本。

- 網站：https://star-grail-online.vercel.app/；完整擴充入口 `/full`。
- 完整原始碼及 19 張專案圖片已同步到 https://github.com/virus11456/starcup 的 main。引擎素材在建置時依固定版本重新產生；秘密、依賴及建置產物不提交。
- 功能版本 GitHub main：`6cd2e83334f5afd133758820c65484afe08a91fe`；本報告的提交只更新文件。
- Vercel 正式部署：`dpl_HM7yaFwNrV9mskhNhwggMK8jWi8t`，原功能版本透過 MCP files 部署。既有專案現已連到 GitHub `virus11456/starcup`，Production 追蹤 `main`。已驗證 GitHub main 提交 a7fb82d8711aaa50390cca19ca50e0de097dcc60 自動觸發部署 dpl_2fAVNk8GRCwv5f53A16vJZe2GHJd；來源為 git，狀態 READY，原正式網域已指向該部署。
- Supabase 已提供核心版房間儲存與多人 API；後端設定已放在 Vercel Production，RLS 阻止瀏覽器直接讀取房間狀態。

## 已更新

- 品牌統一「星杯傳說」，修復首頁頂部導覽被擠到左欄與手機裝飾溢出。
- `/cards` 與 `/full` 共用逐張 150 張圖鑑，附屬性、派系、獨有技標記、牌型效果、搜尋篩選與表格。11 種牌型和 150 張實體牌分開標示。
- 百科為規則主要參考，保存 6 類指南、11 種牌型及 68 個角色頁連結；核心新局牌庫數量與應戰目標依百科修正。
- 抽牌、出牌、放置效果牌、棄牌四種動畫；Three.js 及無 WebGL 備援。完整引擎增加 body 縮放補償，避免手機動畫座標漂移。
- 正式站核心 10 局、1,016 個合法操作及 78 項多人整合檢查通過；完整擴充瀏覽器實玩一局至第 62 個角色回合正常結算。詳見測試報告。

## 尚未完成


- 完整擴充跨裝置多人、68 位角色全部交互技能逐項核對。
- 硬體 WebGL 視覺驗證、完整引擎手機觸控版面改善及實體裝置驗證。
- 高清印刷牌面：目前使用上游角色素材與牌型插畫。

## 重跑檢查

`npm test`、`npm run typecheck`、`npm run prepare:engine`、`npm run test:engine`。

正式站使用 `GRAIL_TEST_URL=https://star-grail-online.vercel.app node scripts/check-live-matches.mjs` 跑十局；`scripts/check-multiplayer.mjs` 跑獨立會話整合。測試建立私密房，不能清空其他房間。報告不含 Cookie、手牌或金鑰。
